# Guía de ejecución revisada — Calidad 360

Revisión: 13 de septiembre de 2026. Entorno examinado: Windows / PowerShell.

Se revisaron frontend, backend, dependencias, migraciones, configuración, Docker, proxy, respaldos, pruebas y documentación. Esta guía contiene ajustes propuestos; no se han aplicado al código ni se han instalado dependencias. La ejecución completa sigue pendiente de comprobar después de preparar el entorno.

**1. Qué contiene el proyecto**

| Parte | Tecnología y función | Archivos principales |
| --- | --- | --- |
| Interfaz | React 19.2.6, TypeScript 5.9.3, Tailwind 4.2.1, componentes shadcn/Base UI, Recharts, React Hook Form y Zod | `app/`, `components/`, `package.json` |
| Herramientas del frontend | Vinext 0.0.50 y Vite 8.0.13; utiliza las APIs de Next 16.2.6 y el plugin de Cloudflare | `vite.config.ts`, `worker/`, `build/` |
| API | FastAPI, SQLAlchemy, validaciones Pydantic, JWT y permisos por rol | `backend/app/` |
| Base operativa | PostgreSQL 16; 15 tablas de negocio y revisión de Alembic | `backend/app/models.py`, `backend/alembic/` |
| Informes | Excel/CSV con pandas y openpyxl; PDF con WeasyPrint | `backend/requirements.txt`, `backend/app/main.py` |
| Despliegue | Nginx, contenedores de frontend/API/base y servicio de respaldo | `docker-compose.yml`, Dockerfiles, `nginx.conf` |

El sistema incluye ocho módulos de control, registros y validaciones, indicadores, no conformidades, acciones PHVA, SPC, lotes, proveedores, transportistas, usuarios, roles, catálogos y parámetros.

La base operativa la administra el backend Python. `db/schema.ts` está vacío y D1/R2 están desactivados en `.openai/hosting.json`. La aplicación operativa no importa los auxiliares de autenticación ChatGPT ni la conexión D1. Para ejecución local no se identificó ninguna API key de OpenAI/Cloudflare obligatoria. `npm run db:generate` no migra PostgreSQL: la herramienta correcta es Alembic.

**2. Estado comprobado en este equipo**

| Elemento | Resultado |
| --- | --- |
| Node.js | Instalado: `v24.21.0`; satisface el mínimo del proyecto `>=22.13.0` |
| npm | Instalado: `11.19.0` |
| Python | Instalado: `3.14.7`; el Dockerfile del proyecto usa `3.12` |
| Git | Disponible; esta carpeta no contiene un repositorio `.git` |
| Docker | Comando no detectado en PATH |
| WSL | `wsl --status` informa que no está instalado |
| PostgreSQL y respaldo | `psql` y `pg_dump` no detectados en PATH; esto no descarta un servidor remoto o una instalación fuera de PATH |
| Dependencias de la interfaz | No existe `node_modules/` |
| Entorno Python del proyecto | No existe `backend/.venv/`; FastAPI, Uvicorn, SQLAlchemy, Alembic, Psycopg, pydantic-settings y pytest no están instalados en el Python consultado |
| Configuración | No existen `.env` raíz ni `backend/.env` |

`package.json` y `package-lock.json` coinciden en sus declaraciones de dependencias. Los 15 archivos Python pasan análisis de sintaxis con `ast.parse`; esto no valida imports, comportamiento ni conexión a PostgreSQL.

Se ejecutó `npm.cmd run dev` y falló con el mensaje `"WRANGLER_LOG_PATH" no se reconoce como un comando interno o externo`. El script usa una asignación POSIX incompatible con el shell predeterminado de npm en Windows.

**3. Ver solamente la interfaz en Windows**

Desde PowerShell:

```powershell
Set-Location "C:\Users\yamir\Downloads\Sistema_Calidad_360"
npm.cmd ci
npx.cmd --no-install vite --host 127.0.0.1 --port 3000
```

Abrir `http://localhost:3000`. Las dependencias se descargan desde el registro npm. Se invoca Vite directamente para evitar el script incompatible; `vite.config.ts` ya establece los ajustes locales de Wrangler.

Sin API conectada, las cuentas demo permiten navegar: `admin`, `coordinador`, `inspector` y `revisor`, contraseña `Calidad2026!`. Los cambios demostrativos no se guardan en PostgreSQL y pueden desaparecer al recargar o cambiar de vista.

La interfaz intenta primero el login real y puede pasar a demostración ante un error de conexión. Entrar al sistema por sí solo no demuestra que la base esté conectada. Esta ruta de interfaz no se ejecutó durante la revisión porque faltan las dependencias.

**4. Ejecutar el sistema completo con Docker en Windows**

Docker concentra PostgreSQL, Python, Node, Nginx y bibliotecas PDF en los contenedores. No hace falta instalar esas herramientas por separado en Windows para esta modalidad.

Primero instalar WSL 2, habilitar virtualización si fuese necesario e instalar Docker Desktop con contenedores Linux. Microsoft documenta este comando desde PowerShell como administrador, seguido del reinicio que indique la instalación:

```powershell
wsl --install
```

Referencias oficiales: [instalación de WSL](https://learn.microsoft.com/en-us/windows/wsl/install) e [instalación de Docker Desktop para Windows](https://docs.docker.com/desktop/setup/install/windows-install/). Docker indica requisitos del equipo, incluyendo 8 GB de RAM para la modalidad WSL 2; no confundirlos con el presupuesto de recursos de la aplicación mencionado en la documentación del proyecto.

Abrir Docker Desktop y comprobar:

```powershell
docker version
docker compose version
```

Antes del primer arranque hay que resolver los ajustes siguientes.

**4.1. Preparar `.env` en la raíz**

```powershell
Set-Location "C:\Users\yamir\Downloads\Sistema_Calidad_360"
if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
```

Este comando conserva cualquier `.env` que ya exista.

Editar `.env` con estos campos:

```dotenv
POSTGRES_DB=calidad360
POSTGRES_USER=calidad360
POSTGRES_PASSWORD=SU_CLAVE_DE_BASE_DE_DATOS
POSTGRES_HOST=database
POSTGRES_PORT=5432
SECRET_KEY=SU_SECRETO_ALEATORIO
INITIAL_PASSWORD=SU_CLAVE_INICIAL_DE_USUARIOS
CORS_ORIGINS=http://localhost:8080
ACCESS_TOKEN_MINUTES=480
RETENTION_YEARS=3
POSTGRES_PUBLIC_PORT=5433
BACKUP_DIR=./backups
```

Los valores `SU_...` son marcadores que deben sustituirse. Para generar una clave de 64 caracteres con el Python que ya tiene este equipo:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

`SECRET_KEY` debe tener al menos 32 caracteres y no contener `cambiar` ni `reemplace`. Copiar la plantilla sin editarla hace fallar la comprobación de producción del backend. Se usa para tokens y firmas: conservarla entre reinicios.

Las cuentas nuevas toman `INITIAL_PASSWORD`; cambiar esta variable después no modifica contraseñas que ya existen. En Docker, `BACKUP_DIR` está fijado a `/backups` por Compose y apunta a un volumen. `RETENTION_YEARS` está declarado, pero no implementa borrado automático de datos o respaldos.

**4.2. Corregir la construcción del frontend**

El `Dockerfile.frontend` actual usa Alpine y ejecuta `npm run build`. Ese script requiere Bash y GNU timeout, que no se instalan. Además, Alpine usa musl, mientras que las herramientas locales de Cloudflare tienen requisitos de glibc. Véanse las [imágenes oficiales Node](https://github.com/nodejs/docker-node) y los [requisitos de Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/).

Una propuesta concreta para reemplazar el contenido de `Dockerfile.frontend` es:

```dockerfile
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx --no-install vinext build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["npx", "--no-install", "vinext", "start", "--hostname", "0.0.0.0", "--port", "3000"]
```

Esto usa Debian, ejecuta el build sin los wrappers Bash y conserva `wget`, requerido por el healthcheck de Compose. Se usa el flag documentado `--hostname` de Vinext. La compatibilidad final del bundle debe verificarse al construir y servir la aplicación; no se ha realizado esa prueba. La fuente de [Vinext 0.0.50](https://raw.githubusercontent.com/cloudflare/vinext/v0.0.50/packages/vinext/src/server/prod-server.ts) contempla bundles que exportan un Worker con `fetch`.

**4.3. Evitar dos problemas de inicialización y diagnóstico**

En `backend/Dockerfile`, para una primera instalación con la lógica actual, cambiar `--workers 2` por `--workers 1`. Cada worker ejecuta el sembrado de usuarios y maestros, que usa consultas e inserciones sin bloqueo. Hay riesgo de colisión al iniciarlos simultáneamente; no se reprodujo en esta revisión. Una mejora posterior sería ejecutar ese sembrado una sola vez antes de crear varios workers.

En `docker-compose.yml`, agregar dentro del servicio existente `backup`:

```yaml
    healthcheck:
      disable: true
```

Aplicar lo mismo a `docker-compose.external.yml` si se utiliza esa modalidad. La imagen del backend define un healthcheck HTTP en el puerto 8000; el proceso de respaldo no sirve HTTP y por eso reportaría `unhealthy` aunque las copias funcionen. Deshabilitarlo elimina ese diagnóstico incorrecto; el resultado real de los respaldos se debe comprobar con logs y archivos.

**4.4. Arrancar y comprobar**

Una vez hechos los ajustes anteriores:

```powershell
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 180
docker compose ps
Invoke-RestMethod http://localhost:8080/api/health
docker compose exec backend python check_database.py
```

| Comprobación | Resultado esperado |
| --- | --- |
| Aplicación | `http://localhost:8080` |
| Documentación API | `http://localhost:8080/docs` |
| `/api/health` | `status: ok`, `database: postgresql` |
| `check_database.py` | `status: ok`, `engine: postgresql`, `tables_expected: 15`, `missing_tables: []` |

Alembic puede añadir su propia tabla; no exigir que `tables_found` sea exactamente 15. El backend aplica migraciones y luego carga usuarios, permisos, parámetros, maestros y algunos datos demostrativos de mejora continua/trazabilidad.

Si falla:

```powershell
docker compose logs --tail 100 backend frontend gateway
docker compose logs --tail 100 database backup
docker compose exec backend alembic current
```

Después del login real, comprobar el indicador de conexión, crear un registro y confirmar que persiste al recargar. También comprobar la descarga de Excel y PDF. El frontend conserva algunos registros demo cuando la API devuelve una lista vacía; por ello, ver filas en pantalla tampoco demuestra persistencia.

**5. Desarrollo local con API y PostgreSQL**

Esta modalidad requiere instalar Python 3.12 para reproducir la versión del Dockerfile, además de PostgreSQL 16 o acceso a una instancia existente. El Python 3.14 detectado no fue probado con las dependencias; no se afirma que sea incompatible.

Se necesita crear una base `calidad360` y un usuario con permisos sobre ella. Alembic crea tablas, no instala PostgreSQL ni crea la base y su rol. Un administrador de PostgreSQL puede ejecutar, en una instalación nueva:

```sql
CREATE ROLE calidad360 LOGIN PASSWORD 'SU_CLAVE_DE_BASE_DE_DATOS';
CREATE DATABASE calidad360 OWNER calidad360 ENCODING 'UTF8';
```

Alternativamente, con Docker instalado y `.env` raíz preparado, levantar solo PostgreSQL:

```powershell
docker compose -f docker-compose.yml -f docker-compose.pgadmin.yml up -d database
```

Así se publica en `127.0.0.1:5433`. El archivo llamado `pgadmin` únicamente publica el puerto; no instala una interfaz pgAdmin.

Crear `backend/.env`:

```dotenv
ENVIRONMENT=development
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=calidad360
POSTGRES_USER=calidad360
POSTGRES_PASSWORD=SU_CLAVE_DE_BASE_DE_DATOS
SECRET_KEY=SU_SECRETO_ALEATORIO
INITIAL_PASSWORD=SU_CLAVE_INICIAL_DE_USUARIOS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Sustituir las claves y usar puerto `5433` si se utiliza el contenedor expuesto. `database` solo es el nombre de host dentro de Docker. El backend busca `.env` respecto del directorio de ejecución: al ejecutar desde `backend/`, la configuración raíz no se carga automáticamente.

En una terminal PowerShell:

```powershell
Set-Location "C:\Users\yamir\Downloads\Sistema_Calidad_360\backend"
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe check_database.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

No es necesario activar el entorno si se invoca su Python directamente. Gunicorn se usa en Linux/Docker; para desarrollo Windows se utiliza Uvicorn.

Para conectar la interfaz, agregar `proxy` dentro del objeto `server` ya existente en `vite.config.ts`, conservando el resto de la configuración:

```typescript
proxy: {
  "/api": {
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
  },
},
```

La interfaz usa rutas relativas `/api/...`. No existe una variable `API_URL` implementada: añadir una variable al `.env` sin cambiar el código no conecta ambos servicios. CORS tampoco cambia el destino de las peticiones. El proxy solo se necesita en esta modalidad de desarrollo; Docker ya usa Nginx para dirigir las rutas.

En otra terminal, desde la raíz:

```powershell
npm.cmd ci
npx.cmd --no-install vite --host 127.0.0.1 --port 3000
```

Abrir `http://localhost:3000`; la documentación API está en `http://127.0.0.1:8000/docs`. Verificar también `http://localhost:3000/api/health`: debe alcanzar la API a través del proxy.

**6. Dependencias que se instalan automáticamente**

`npm.cmd ci` instala los paquetes de `package-lock.json`, incluidas herramientas de desarrollo. No ejecutar `npm ci --omit=dev` antes de compilar: Vite y Vinext están en `devDependencies`.

`pip install -r requirements.txt`, desde `backend/`, instala:

| Grupo | Paquetes declarados |
| --- | --- |
| API y servidores | `fastapi`, `uvicorn[standard]`, `gunicorn` |
| PostgreSQL y migraciones | `sqlalchemy`, `alembic`, `psycopg[binary]` |
| Configuración y entradas | `pydantic-settings`, `python-multipart`, `email-validator` |
| Autenticación | `python-jose[cryptography]`, `passlib[bcrypt]`, `bcrypt` |
| Excel y PDF | `pandas`, `openpyxl`, `weasyprint` |
| Pruebas | `httpx`, `pytest` |

El archivo Python utiliza rangos de versiones y no existe lockfile Python: una instalación futura puede resolver versiones diferentes dentro de esos rangos.

En Windows, la generación PDF requiere además Pango y sus bibliotecas. Docker las instala en `backend/Dockerfile`. Para instalación nativa, seguir la [guía oficial de WeasyPrint](https://doc.courtbouillon.org/weasyprint/latest/first_steps.html#windows); la documentación actual utiliza MSYS2 y Pango. La API puede iniciar sin estas bibliotecas y fallar posteriormente al solicitar el PDF.

Los scripts `install:ci`, `build` y `lint` actuales dependen de Bash o herramientas Linux. Para comprobar build y lint desde Windows después de instalar dependencias:

```powershell
npx.cmd --no-install vinext build
npx.cmd --no-install eslint . --ignore-pattern dist --ignore-pattern .next
```

**7. PostgreSQL existente, puertos y otros equipos**

Para conectar todos los contenedores a una base institucional, configurar `.env` raíz con `DATABASE_URL=postgresql+psycopg://usuario:clave_codificada@servidor:5432/base`, además de `SECRET_KEY` y las demás variables aplicables, y usar:

```powershell
docker compose -f docker-compose.external.yml up --build -d --wait --wait-timeout 180
docker compose -f docker-compose.external.yml exec backend python check_database.py
```

Los ajustes del Dockerfile frontend también aplican aquí. Conservar `-f docker-compose.external.yml` en los comandos posteriores. El Compose principal no transmite `DATABASE_URL`; para esa modalidad transmite los campos `POSTGRES_*`.

Desde Docker Desktop, para una base instalada en la PC anfitriona, utilizar `host.docker.internal` como servidor; `localhost` dentro del contenedor apunta al propio contenedor. Codificar caracteres reservados de usuario/contraseña en la URL. Si el servidor exige TLS, la API acepta parámetros de conexión, pero el script actual de respaldo no propaga parámetros como `sslmode` al reconstruir la llamada a `pg_dump` y requiere corregirse para reproducir esa configuración.

| Puerto | Uso |
| --- | --- |
| `8080` | Entrada publicada por Nginx en Docker |
| `3000` | Frontend; interno en Docker, local en desarrollo |
| `8000` | API; interno en Docker, local en desarrollo |
| `5432` | PostgreSQL; interno en el Compose base |
| `5433` | Publicación opcional de PostgreSQL solo en `127.0.0.1` |

Para acceder por LAN al despliegue Docker, usar `http://IP-DE-LA-PC:8080` y permitir ese puerto en la red privada del firewall. El Nginx incluido solo configura HTTP; HTTPS requiere certificado y proxy TLS adicional.

**8. Usuarios, respaldos y parada**

| Usuario inicial | Rol |
| --- | --- |
| `admin` | Administrador |
| `coordinador` | Coordinador |
| `inspector` | Inspector |
| `revisor` | Revisor |

La contraseña inicial real es la elegida en `INITIAL_PASSWORD`; la plantilla utiliza `Calidad2026!`. Cambiar las contraseñas desde el perfil antes de registrar información real y revisar los parámetros y maestros demostrativos cargados por el sistema.

El servicio de respaldo intenta una copia al arrancar y luego aproximadamente cada 24 horas. La primera puede ocurrir antes de terminar las migraciones; generar una copia posterior a la puesta en marcha:

```powershell
docker compose run --rm backup python backup.py
New-Item -ItemType Directory -Path .\backups -Force
docker compose cp backup:/backups/. ./backups
docker compose logs --tail 100 backup
```

La base vive en el volumen `calidad_db` y las copias en `calidad_backups`, con el prefijo que asigne Compose. Conservar una copia fuera del equipo y comprobar que puede restaurarse.

Ejecutar `python backend/backup.py` nativamente no basta con tener `.env`: ese script solo consulta variables del proceso y requiere `pg_dump` y `gzip` en PATH. No incluye retención automática de copias.

Para detener conservando datos:

```powershell
docker compose down
```

No añadir `-v`, porque elimina los volúmenes. Cambiar `POSTGRES_PASSWORD` en `.env` tampoco actualiza por sí solo la contraseña de un usuario en una base ya inicializada; hay que mantener ambos valores coordinados.

**9. Alcance de las pruebas pendientes**

Existen ocho pruebas backend de autenticación, registros, validaciones, maestros, PHVA, lotes, roles y SPC. Usan SQLite en `test_calidad360.db`; no verifican PostgreSQL, despliegue Docker o PDF. El frontend tiene pruebas de renderizado y componentes que requieren una compilación previa.

Para backend, desde `backend/`, con el entorno virtual ya instalado, en una terminal de pruebas separada:

```powershell
$env:ENVIRONMENT = "test"
$env:INITIAL_PASSWORD = "Calidad2026!"
.\.venv\Scripts\python.exe -m pytest -q
```

La suite configura su propia URL SQLite y secreto de pruebas. Mantiene un archivo de prueba entre ejecuciones. No usar estas variables de prueba para ejecutar la API operativa.

No se ejecutaron instalaciones, compilación, suites ni contenedores durante esta revisión. Las comprobaciones realizadas fueron lectura de código/configuración, detección de herramientas, concordancia de manifiestos npm, análisis de sintaxis Python y reproducción del error del script `dev` en Windows.
