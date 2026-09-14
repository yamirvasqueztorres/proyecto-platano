"""Verifica que Calidad 360 esté conectado al esquema PostgreSQL esperado."""
import json

from sqlalchemy import inspect, text

from app.database import Base, engine
from app import models  # noqa: F401


backend = engine.url.get_backend_name()
if backend != "postgresql":
    raise SystemExit(f"Conexión inválida: se esperaba PostgreSQL y se obtuvo {backend}")

with engine.connect() as connection:
    database, user, version = connection.execute(
        text("select current_database(), current_user, version()")
    ).one()

existing_tables = set(inspect(engine).get_table_names())
expected_tables = set(Base.metadata.tables)
missing_tables = sorted(expected_tables - existing_tables)

result = {
    "status": "ok" if not missing_tables else "incomplete",
    "database": database,
    "user": user,
    "engine": backend,
    "postgresql_version": version.split(",")[0],
    "tables_found": len(existing_tables),
    "tables_expected": len(expected_tables),
    "missing_tables": missing_tables,
}
print(json.dumps(result, ensure_ascii=False, indent=2))

if missing_tables:
    raise SystemExit("El esquema está incompleto. Ejecute: alembic upgrade head")
