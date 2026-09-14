# Calidad 360

Sistema Digital de Análisis de Calidad para la Mejora Continua en el Procesamiento de Plátano Verde, desarrollado con **FastAPI (Python)**, **React + TypeScript**, PostgreSQL y una interfaz responsive inspirada en Chakra UI.

## Funciones incluidas

- Autenticación JWT y permisos por rol: Administrador, Coordinador, Inspector y Revisor.
- Ocho módulos operativos: FOR-CCD-001, 002, 005, 007, 010, 018, 019 y 023.
- Validaciones de campos, consistencia de totales, límites de defectos y rangos configurables.
- Registro automático de inicio, fin y duración de cada formulario.
- Flujo de aprobación, observación y rechazo con código único y firma HMAC.
- Dashboard de conformidad, peso, defectos, tiempos y tendencias.
- Gestión de no conformidades con severidad, causa raíz, disposición y cierre controlado.
- Acciones correctivas con ciclo PHVA, responsable, plazo, eficacia y vencimientos.
- Análisis estadístico SPC con media, desviación, LCI/LCS, Cp/Cpk y detección fuera de control.
- Trazabilidad de lotes por eventos, etapas, registros relacionados y retención/liberación.
- Gestión de proveedores, transportistas, usuarios, permisos, catálogos, parámetros y notificaciones; los registros operativos conservan los identificadores de sus datos maestros.
- Perfil personal con actualización de datos y cambio seguro de contraseña.
- Trazabilidad de acciones con usuario, fecha, IP, entidad y detalle.
- Exportación Excel y PDF; importación histórica desde Excel/CSV.
- Diseño adaptable a computadora, tablet y smartphone.
- PostgreSQL 16 como base de datos obligatoria de operación; SQLite se reserva exclusivamente para las pruebas automatizadas.
- Contenedores Docker, proxy Nginx, verificación de salud y respaldo programable.

## Inicio rápido con Docker

1. Copiar `.env.example` como `.env` y reemplazar las claves de seguridad.
2. Ejecutar `docker compose up --build -d`.
3. Abrir `http://localhost:8080`.
4. Consultar la documentación de la API en `http://localhost:8080/docs`.

La primera ejecución aplica automáticamente las migraciones de Alembic, crea el esquema y carga los datos iniciales en PostgreSQL. Compruebe la instalación con:

```bash
docker compose ps
curl http://localhost:8080/api/health
docker compose exec backend python check_database.py
```

El campo `database` de la respuesta debe ser `postgresql` y el verificador no debe reportar tablas faltantes. Para utilizar un PostgreSQL institucional ya existente, use `docker-compose.external.yml` y siga `docs/DESPLIEGUE_POSTGRESQL.md`.

## Inicio para desarrollo

Backend (requiere PostgreSQL y `DATABASE_URL` configurada):

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend, en otra terminal:

```bash
npm ci
npm run dev -- --host 0.0.0.0 --port 3000
```

Si se accede desde una tablet o smartphone conectado a la misma red, utilizar la IP de la PC, por ejemplo `http://192.168.1.20:3000`. Para una instalación institucional, se recomienda HTTPS, dominio interno, contraseña de base de datos robusta y un `SECRET_KEY` aleatorio.

## Credenciales iniciales

| Usuario | Contraseña | Rol |
| --- | --- | --- |
| `admin` | `Calidad2026!` | Administrador |
| `coordinador` | `Calidad2026!` | Coordinador de calidad |
| `inspector` | `Calidad2026!` | Inspector de calidad |
| `revisor` | `Calidad2026!` | Revisor de solo lectura |

Cambiar estas contraseñas antes de usar datos reales.

## Estructura

```text
app/                    interfaz React/TypeScript
backend/app/            API, modelos, seguridad y reglas de calidad
backend/alembic/        migraciones idempotentes del esquema PostgreSQL
backend/tests/          pruebas de autenticación, roles, cálculo y firma
backend/backup.py       respaldo PostgreSQL
backend/check_database.py diagnóstico de conexión y esquema
docker-compose.external.yml conexión a PostgreSQL institucional
docker-compose.pgadmin.yml acceso local temporal con pgAdmin/DBeaver
app/feature-pages.tsx   mejora continua, SPC, lotes y administración
docker-compose.yml      despliegue integral
nginx.conf              acceso unificado y proxy /api
.env.example            variables requeridas
```

## Seguridad implementada

Las contraseñas se guardan con bcrypt. Los tokens JWT vencen según configuración. Las autorizaciones configurables se verifican en el servidor y no dependen de ocultar botones en la interfaz. SQLAlchemy utiliza consultas parametrizadas. Pydantic valida entradas y tamaños. Los registros aprobados conservan una firma HMAC verificable y todas las acciones críticas generan auditoría.

## Respaldo diario

Ejecutar `python backend/backup.py` mediante el Programador de tareas de Windows o cron. `BACKUP_DIR` define el destino; el contenedor del backend ya incluye `pg_dump`.

## Criterio de datos demostrativos

Los valores visibles en la demostración se presentan únicamente para probar navegación, filtros, gráficos y flujos. Los rangos definitivos de °Brix, humedad, temperatura y peso deben ser aprobados por Control de Calidad y cargados en Configuración antes de operar.

Consulte `docs/DESPLIEGUE_POSTGRESQL.md` para conectar PostgreSQL, desplegar, actualizar y verificar la instalación. `docs/MANUAL_USUARIO.md` explica los flujos operativos.
