import gzip
import io
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace

import pytest
from psycopg.conninfo import conninfo_to_dict

import backup
from app.config import Settings


DUMP = (
    b"-- PostgreSQL database dump\n"
    b"CREATE TABLE example (id integer);\n"
    b"-- PostgreSQL database dump complete\n"
)
DATABASE_URL = (
    "postgresql+psycopg://operator:p%40ss%3Aword@localhost:5432/calidad360"
    "?sslmode=verify-full&sslrootcert=C%3A%2Fcerts%2Froot.crt&connect_timeout=7"
)


def backup_settings(tmp_path, **values):
    return Settings(
        _env_file=None,
        database_url=DATABASE_URL,
        backup_dir=str(tmp_path),
        **values,
    )


def fake_postgres(monkeypatch, returncode=0):
    calls = {}

    def connect(**parameters):
        calls["connection"] = parameters
        return nullcontext(SimpleNamespace(info=SimpleNamespace(server_version=180000)))

    def popen(command, **options):
        calls["command"] = command
        calls["options"] = options
        return SimpleNamespace(
            stdout=io.BytesIO(DUMP),
            wait=lambda: returncode,
            poll=lambda: returncode,
        )

    monkeypatch.setattr(backup.psycopg, "connect", connect)
    monkeypatch.setattr(backup, "find_pg_dump", lambda *args: Path("pg_dump.exe"))
    monkeypatch.setattr(backup.subprocess, "Popen", popen)
    return calls


def test_backup_compresses_without_gzip_executable_and_preserves_tls(monkeypatch, tmp_path):
    calls = fake_postgres(monkeypatch)

    result = backup.create_backup(backup_settings(tmp_path))

    assert result.parent == tmp_path
    assert gzip.decompress(result.read_bytes()) == DUMP
    assert backup.verify_backup(result) == len(DUMP)
    assert calls["command"][0] == "pg_dump.exe"
    connection = calls["connection"]
    dump_connection = conninfo_to_dict(calls["command"][2])
    for key in ("host", "port", "user", "dbname", "sslmode", "sslrootcert", "connect_timeout"):
        assert dump_connection[key] == connection[key]
    assert connection["password"] == "p@ss:word"
    assert calls["options"]["env"]["PGPASSWORD"] == "p@ss:word"
    assert "password" not in dump_connection
    assert "p@ss:word" not in " ".join(calls["command"])
    assert list(tmp_path.iterdir()) == [result]


def test_failed_pg_dump_does_not_publish_or_leave_partial_backup(monkeypatch, tmp_path):
    fake_postgres(monkeypatch, returncode=1)

    with pytest.raises(backup.BackupError, match="no pudo completar"):
        backup.create_backup(backup_settings(tmp_path))

    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("damage", ["deflate", "truncated", "incomplete_sql"])
def test_verify_rejects_corrupted_or_incomplete_backups(tmp_path, damage):
    compressed = gzip.compress(DUMP)
    if damage == "deflate":
        # A reserved DEFLATE block type raises zlib.error, not gzip.BadGzipFile.
        compressed = compressed[:10] + b"\x07" + compressed[-8:]
    elif damage == "truncated":
        compressed = compressed[:-5]
    else:
        compressed = gzip.compress(b"-- PostgreSQL database dump\n")
    archive = tmp_path / "broken.sql.gz"
    archive.write_bytes(compressed)

    with pytest.raises(backup.BackupError):
        backup.verify_backup(archive)


def test_client_older_than_server_is_rejected(monkeypatch):
    monkeypatch.setattr(backup, "_pg_dump_candidates", lambda explicit: [Path("pg_dump.exe")])
    monkeypatch.setattr(
        backup.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="pg_dump (PostgreSQL) 16.4"),
    )

    with pytest.raises(backup.BackupError, match="PostgreSQL 18"):
        backup.find_pg_dump(18)
