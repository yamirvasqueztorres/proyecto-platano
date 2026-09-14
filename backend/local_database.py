"""Administra únicamente la instancia PostgreSQL privada de este proyecto."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile

import psycopg
from psycopg import sql

PROJECT = Path(__file__).resolve().parent.parent
LOCAL = PROJECT / ".local"
CLUSTER = LOCAL / "postgres" / "data"
STATE = LOCAL / "postgres" / "instance.json"
LOGS = LOCAL / "logs"
BACKEND_ENV = PROJECT / "backend" / ".env"


class LocalDatabaseError(Exception):
    pass


def run(arguments: list[str], *, timeout: int = 60) -> subprocess.CompletedProcess:
    return subprocess.run(
        arguments, capture_output=True, text=True, errors="replace", timeout=timeout,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )


def binaries() -> Path:
    roots = [Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "PostgreSQL"]
    candidates = [path for root in roots for path in root.glob("*/bin")]
    if override := os.environ.get("LOCAL_POSTGRES_BIN"):
        candidates.insert(0, Path(override))
    candidates.sort(key=lambda p: int(p.parent.name) if p.parent.name.isdigit() else 0, reverse=True)
    for path in candidates:
        if all((path / name).is_file() for name in ("initdb.exe", "pg_ctl.exe", "pg_dump.exe")):
            return path.resolve()
    raise LocalDatabaseError("Instala PostgreSQL con sus herramientas cliente o define LOCAL_POSTGRES_BIN.")


def load_state() -> dict:
    if not STATE.is_file():
        raise LocalDatabaseError("La base del proyecto no está configurada. Ejecuta local_database.py init.")
    state = json.loads(STATE.read_text(encoding="utf-8"))
    if Path(state["data_directory"]).resolve() != CLUSTER.resolve():
        raise LocalDatabaseError("La ubicación de esta instancia cambió. Revisa la configuración antes de iniciarla.")
    return state


def control(state: dict, action: str) -> subprocess.CompletedProcess:
    args = [str(Path(state["bin"]) / "pg_ctl.exe"), action, "-D", str(CLUSTER)]
    if action == "start":
        args += ["-l", str(LOGS / "postgres.log"), "-w", "-t", "45"]
    elif action == "stop":
        args += ["-m", "fast", "-w", "-t", "45"]
    # PostgreSQL puede heredar handles de pg_ctl en Windows. Un archivo evita
    # que communicate() espere indefinidamente por pipes de un servidor vivo.
    LOGS.mkdir(parents=True, exist_ok=True)
    with (LOGS / "pg-control.log").open("a", encoding="utf-8") as log:
        return subprocess.run(
            args, stdout=log, stderr=subprocess.STDOUT, timeout=60,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )


def port_available(port: int) -> bool:
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def admin_connection(state: dict):
    return psycopg.connect(
        host="127.0.0.1", port=state["port"], user=state["admin_user"],
        password=state["admin_password"], dbname="postgres", connect_timeout=5, autocommit=True,
    )


def assert_identity(state: dict) -> None:
    with admin_connection(state) as connection:
        directory = connection.execute("SHOW data_directory").fetchone()[0]
    if Path(directory).resolve() != CLUSTER.resolve():
        raise LocalDatabaseError("El puerto está conectado a otra instancia PostgreSQL; no se modificó esa instancia.")


def start() -> dict:
    state = load_state()
    if not (CLUSTER / "PG_VERSION").is_file():
        raise LocalDatabaseError("El clúster no está inicializado. Ejecuta local_database.py init.")
    LOGS.mkdir(parents=True, exist_ok=True)
    if control(state, "status").returncode != 0:
        if not port_available(state["port"]):
            raise LocalDatabaseError(f"El puerto {state['port']} está ocupado. No se detuvo ningún proceso ajeno.")
        result = control(state, "start")
        if result.returncode:
            raise LocalDatabaseError("PostgreSQL no inició. Revisa .local/logs/postgres.log.")
    assert_identity(state)
    print(f"PostgreSQL del proyecto disponible en 127.0.0.1:{state['port']}.")
    return state


def initialize(port: int) -> None:
    if STATE.exists():
        state = load_state()
        if port != state["port"]:
            raise LocalDatabaseError("Esta instancia ya usa otro puerto. Se conservó su configuración.")
    else:
        if BACKEND_ENV.exists():
            raise LocalDatabaseError("Ya existe backend/.env. Se conservó: revisa su conexión antes de crear otra instancia.")
        if CLUSTER.exists() and any(CLUSTER.iterdir()):
            raise LocalDatabaseError("La carpeta de datos contiene archivos sin registro de instancia. Se conservaron.")
        if not port_available(port):
            raise LocalDatabaseError(f"El puerto {port} ya está ocupado. Elige otro con --port.")
        state = {
            "bin": str(binaries()), "data_directory": str(CLUSTER.resolve()), "port": port,
            "admin_user": "calidad360_owner", "admin_password": secrets.token_urlsafe(32),
            "database": "calidad360", "app_user": "calidad360", "app_password": secrets.token_urlsafe(32),
            "secret_key": secrets.token_hex(32), "initial_password": secrets.token_urlsafe(16),
        }
        STATE.parent.mkdir(parents=True, exist_ok=True)
        with STATE.open("x", encoding="utf-8") as target:
            json.dump(state, target, indent=2)

    LOGS.mkdir(parents=True, exist_ok=True)
    if not (CLUSTER / "PG_VERSION").exists():
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=STATE.parent, delete=False) as secret:
            secret.write(state["admin_password"] + "\n")
            secret_path = Path(secret.name)
        try:
            result = run([
                str(Path(state["bin"]) / "initdb.exe"), "-D", str(CLUSTER),
                "--username", state["admin_user"], "--pwfile", str(secret_path),
                "--auth-host=scram-sha-256", "--auth-local=scram-sha-256",
                "--encoding=UTF8", "--locale=C", "--no-instructions",
                "-c", "listen_addresses=127.0.0.1", "-c", f"port={port}",
                "-c", "timezone=America/Lima", "-c", "log_timezone=America/Lima",
            ], timeout=120)
            (LOGS / "initdb.log").write_text(result.stdout + result.stderr, encoding="utf-8")
            if result.returncode:
                raise LocalDatabaseError("No se pudo inicializar PostgreSQL. Revisa .local/logs/initdb.log.")
        finally:
            secret_path.unlink(missing_ok=True)

    start()
    with admin_connection(state) as connection:
        role = connection.execute("SELECT rolname FROM pg_roles WHERE rolname=%s", (state["app_user"],)).fetchone()
        if not role:
            connection.execute(sql.SQL("CREATE ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD {}").format(
                sql.Identifier(state["app_user"]), sql.Literal(state["app_password"]),
            ))
        database = connection.execute(
            "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=%s", (state["database"],),
        ).fetchone()
        if not database:
            connection.execute(sql.SQL("CREATE DATABASE {} OWNER {} ENCODING 'UTF8'").format(
                sql.Identifier(state["database"]), sql.Identifier(state["app_user"]),
            ))
        elif database[0] != state["app_user"]:
            raise LocalDatabaseError("La base existente tiene otro propietario. Se conservó sin modificaciones.")

    if not BACKEND_ENV.exists():
        values = {
            "ENVIRONMENT": "production", "POSTGRES_HOST": "127.0.0.1", "POSTGRES_PORT": str(port),
            "POSTGRES_DB": state["database"], "POSTGRES_USER": state["app_user"],
            "POSTGRES_PASSWORD": state["app_password"], "SECRET_KEY": state["secret_key"],
            "INITIAL_PASSWORD": state["initial_password"], "SEED_DEMO_DATA": "false",
            "CORS_ORIGINS": "http://localhost:3000,http://127.0.0.1:3000",
            "ACCESS_TOKEN_MINUTES": "480", "BACKUP_DIR": "./backups",
            "PG_DUMP_PATH": (Path(state["bin"]) / "pg_dump.exe").as_posix(),
        }
        with BACKEND_ENV.open("x", encoding="utf-8") as target:
            target.write("# Configuración local privada. No compartir ni publicar.\n")
            target.write("".join(f"{key}={value}\n" for key, value in values.items()))
    frontend_env = PROJECT / ".env.local"
    if not frontend_env.exists():
        frontend_env.write_text("VITE_ENABLE_DEMO=false\nAPI_PROXY_TARGET=http://127.0.0.1:8000\n", encoding="utf-8")
    access = LOCAL / "ACCESO_LOCAL.txt"
    if not access.exists():
        access.write_text(
            "CALIDAD 360 - ACCESO LOCAL PRIVADO\n\nAplicación: http://localhost:3000\n"
            "Usuarios iniciales: admin, coordinador, inspector, revisor\n"
            f"Contraseña inicial: {state['initial_password']}\n"
            "Cambiar la contraseña de cada cuenta desde Mi perfil.\n"
            "Cambiar INITIAL_PASSWORD no cambia cuentas ya creadas.\n\n"
            f"PostgreSQL: 127.0.0.1:{port}\nBase: {state['database']}\n"
            f"Usuario de base: {state['app_user']}\nContraseña de base: {state['app_password']}\n"
            "Configuración API: backend/.env\nDatos persistentes: .local/postgres/data\n"
            "No compartir este archivo ni subir la carpeta .local a un repositorio.\n",
            encoding="utf-8",
        )
    print("Base y usuario configurados. Credenciales guardadas en .local/ACCESO_LOCAL.txt.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["init", "start", "stop", "status"])
    parser.add_argument("--port", type=int, default=5433)
    args = parser.parse_args()
    try:
        if not 1024 <= args.port <= 65535:
            raise LocalDatabaseError("El puerto debe estar entre 1024 y 65535.")
        if args.action == "init":
            initialize(args.port)
        elif args.action == "start":
            start()
        elif args.action == "status":
            state = load_state()
            if control(state, "status").returncode:
                raise LocalDatabaseError("PostgreSQL del proyecto está detenido.")
            assert_identity(state)
            print(f"PostgreSQL activo: 127.0.0.1:{state['port']}, base {state['database']}.")
        else:
            state = load_state()
            if control(state, "status").returncode == 0:
                assert_identity(state)
                if control(state, "stop").returncode:
                    raise LocalDatabaseError("PostgreSQL no confirmó la parada. Revisa el log.")
            print("PostgreSQL del proyecto detenido; datos conservados.")
    except LocalDatabaseError as error:
        raise SystemExit(str(error)) from None
    except psycopg.Error:
        raise SystemExit("Error de conexión/configuración PostgreSQL. Revisa los logs locales; no se imprimen credenciales.") from None
    except (OSError, ValueError, subprocess.TimeoutExpired):
        raise SystemExit("No se pudo completar la operación local. Revisa rutas, permisos y .local/logs.") from None


if __name__ == "__main__":
    main()
