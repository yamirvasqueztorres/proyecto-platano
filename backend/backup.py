"""Respaldo PostgreSQL portable; no necesita el ejecutable gzip en Windows."""
from __future__ import annotations

import argparse
import gzip
import os
import re
import shutil
import subprocess
import tempfile
import zlib
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import psycopg
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from app.config import Settings, get_settings


class BackupError(Exception):
    """Error apto para mostrar sin credenciales ni cadenas de conexión."""


def connection_parameters(settings: Settings) -> dict[str, str]:
    if settings.database_url:
        url = settings.database_url
        if url.startswith("postgresql+psycopg://"):
            url = url.replace("postgresql+psycopg://", "postgresql://", 1)
        if not url.startswith(("postgresql://", "postgres://")):
            raise BackupError("DATABASE_URL debe apuntar a PostgreSQL.")
        try:
            # libpq conserva sslmode, certificados, opciones y parámetros del URI.
            params = conninfo_to_dict(url)
        except psycopg.Error:
            raise BackupError("DATABASE_URL no es una conexión PostgreSQL válida.") from None
    else:
        params = {
            "host": settings.postgres_host,
            "port": str(settings.postgres_port),
            "user": settings.postgres_user,
            "password": settings.postgres_password,
            "dbname": settings.postgres_db,
        }
    params.setdefault("connect_timeout", "10")
    return params


def _process_options() -> dict:
    return {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}


def _pg_dump_candidates(explicit: str | None) -> list[Path]:
    if explicit:
        return [Path(explicit)]
    candidates = []
    on_path = shutil.which("pg_dump")
    if on_path:
        candidates.append(Path(on_path))
    if os.name == "nt":
        for variable in ("ProgramW6432", "ProgramFiles", "ProgramFiles(x86)"):
            if root := os.environ.get(variable):
                candidates.extend((Path(root) / "PostgreSQL").glob("*/bin/pg_dump.exe"))
    return list(dict.fromkeys(candidates))


def find_pg_dump(server_major: int, explicit: str | None = None) -> Path:
    versions = []
    for candidate in _pg_dump_candidates(explicit):
        try:
            result = subprocess.run(
                [str(candidate), "--version"], capture_output=True, text=True,
                timeout=10, check=False, **_process_options(),
            )
        except (OSError, subprocess.TimeoutExpired):
            continue
        match = re.search(r"pg_dump \(PostgreSQL\) (\d+)", result.stdout)
        if result.returncode == 0 and match:
            versions.append((int(match[1]), candidate))
    compatible = [(major, path) for major, path in versions if major >= server_major]
    if compatible:
        return max(compatible, key=lambda item: item[0])[1]
    raise BackupError(
        f"No se encontró pg_dump compatible con PostgreSQL {server_major}. "
        f"Instala las herramientas cliente {server_major} o posteriores y configura PG_DUMP_PATH."
    )


def create_backup(settings: Settings) -> Path:
    params = connection_parameters(settings)
    try:
        with psycopg.connect(**params, autocommit=True) as connection:
            server_major = connection.info.server_version // 10000
    except psycopg.Error:
        raise BackupError(
            "No se pudo conectar a PostgreSQL. Revisa el servicio y la configuración .env."
        ) from None
    executable = find_pg_dump(server_major, settings.pg_dump_path)
    destination = Path(settings.backup_dir).expanduser()
    if not destination.is_absolute():
        destination = Path(__file__).resolve().parent.parent / destination
    destination.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    target = destination / f"calidad360_{stamp}_{uuid4().hex[:8]}.sql.gz"

    # La contraseña no aparece en argumentos ni en mensajes de error.
    env = dict(os.environ)
    password = params.pop("password", None)
    if password is not None:
        env["PGPASSWORD"] = password
    command = [
        str(executable), "--dbname", make_conninfo(**params), "--no-password",
        "--no-owner", "--no-privileges", "--format=plain",
    ]
    descriptor, filename = tempfile.mkstemp(prefix=".calidad360_", suffix=".part", dir=destination)
    partial = Path(filename)
    dump = None
    try:
        with os.fdopen(descriptor, "wb") as output, tempfile.TemporaryFile() as errors:
            dump = subprocess.Popen(
                command, stdout=subprocess.PIPE, stderr=errors, env=env, **_process_options(),
            )
            assert dump.stdout is not None
            with dump.stdout, gzip.GzipFile(fileobj=output, mode="wb", compresslevel=9) as compressed:
                shutil.copyfileobj(dump.stdout, compressed, length=1024 * 1024)
            if dump.wait() != 0:
                raise BackupError(
                    "pg_dump no pudo completar el respaldo. Revisa permisos de lectura, "
                    "conexión y espacio en disco; no se publicó un respaldo incompleto."
                )
        partial.rename(target)
        return target.resolve()
    finally:
        if dump is not None and dump.poll() is None:
            dump.kill()
            dump.wait()
        # Sólo se elimina el archivo temporal creado por esta ejecución.
        partial.unlink(missing_ok=True)


def verify_backup(path: Path) -> int:
    """Valida la integridad gzip y las marcas del dump sin ejecutar su SQL."""
    size = 0
    beginning = b""
    ending = b""
    try:
        with gzip.open(path, "rb") as source:
            while chunk := source.read(1024 * 1024):
                if not beginning:
                    beginning = chunk[:4096]
                ending = (ending + chunk)[-4096:]
                size += len(chunk)
    except (OSError, EOFError, zlib.error):
        raise BackupError("El respaldo no existe o el archivo gzip está dañado.") from None
    if b"PostgreSQL database dump" not in beginning or b"PostgreSQL database dump complete" not in ending:
        raise BackupError("El archivo no contiene un dump SQL completo de PostgreSQL.")
    return size


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", type=Path, help="Verifica un .sql.gz sin restaurar ni modificar la base.")
    args = parser.parse_args()
    try:
        if args.verify:
            size = verify_backup(args.verify)
            print(f"Respaldo íntegro: {size} bytes SQL. La restauración no se ha ejecutado.")
        else:
            print(create_backup(get_settings()))
    except BackupError as error:
        raise SystemExit(str(error)) from None
    except (OSError, ValueError):
        raise SystemExit("No se pudo crear el respaldo. Revisa .env, las rutas y los permisos de escritura.") from None


if __name__ == "__main__":
    main()
