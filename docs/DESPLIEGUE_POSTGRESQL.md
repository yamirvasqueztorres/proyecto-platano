# Guía de conexión y despliegue con PostgreSQL

Esta guía cubre dos escenarios: una instalación completa que crea PostgreSQL automáticamente y una conexión a un servidor PostgreSQL ya existente. En ambos casos, el backend aplica las migraciones de Alembic antes de iniciar.

## Requisitos

- Docker Desktop 4 o Docker Engine con Compose v2.
- 4 GB de RAM disponibles, 5 GB de disco libre y acceso al puerto 8080.
- Para uso desde tablet o smartphone, todos los equipos deben alcanzar la IP o el dominio del servidor.

## Opción A: PostgreSQL incluido

Es la opción recomendada para una instalación nueva.

### 1. Crear la configuración

Copie `.env.example` con el nombre `.env`. Defina al menos:

```dotenv
POSTGRES_DB=calidad360
POSTGRES_USER=calidad360
POSTGRES_PASSWORD=una_clave_robusta
SECRET_KEY=una_cadena_aleatoria_de_64_caracteres
INITIAL_PASSWORD=Calidad2026!
CORS_ORIGINS=http://localhost:8080
```

Genere `SECRET_KEY` con:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

`POSTGRES_PASSWORD` se pasa a PostgreSQL como un valor separado, por lo que puede contener caracteres especiales sin modificar una URL. No publique el archivo `.env`.

### 2. Iniciar el sistema

```bash
docker compose up --build -d
docker compose ps
```

El inicio crea la base, aplica `alembic upgrade head`, carga los datos maestros iniciales y habilita el acceso en `http://localhost:8080`.

### 3. Comprobar la conexión

```bash
curl http://localhost:8080/api/health
docker compose exec backend python check_database.py
```

La primera respuesta debe incluir `"database":"postgresql"`. La segunda debe informar `status: ok`, 15 tablas esperadas y una lista vacía en `missing_tables`.

## Opción B: PostgreSQL existente

Use esta opción si la institución ya administra PostgreSQL. El servidor debe aceptar conexiones desde los contenedores y el usuario asignado debe tener permisos para crear y modificar las tablas del esquema.

### 1. Crear base y usuario

Ejecute como administrador de PostgreSQL y reemplace la contraseña:

```sql
CREATE ROLE calidad360 LOGIN PASSWORD 'CLAVE_SEGURA';
CREATE DATABASE calidad360 OWNER calidad360 ENCODING 'UTF8';
GRANT ALL PRIVILEGES ON DATABASE calidad360 TO calidad360;
```

En servicios administrados, estos objetos pueden crearse desde el panel del proveedor.

### 2. Configurar la URL

En `.env`, defina:

```dotenv
DATABASE_URL=postgresql+psycopg://calidad360:CLAVE@servidor:5432/calidad360
SECRET_KEY=una_cadena_aleatoria_de_64_caracteres
INITIAL_PASSWORD=Calidad2026!
CORS_ORIGINS=http://localhost:8080
```

Si usuario o contraseña contienen `@`, `:`, `/`, `#`, `%` u otros caracteres reservados, codifíquelos para URL. Puede obtener el valor codificado con:

```bash
python -c "from urllib.parse import quote_plus; print(quote_plus(input('Clave: ')))"
```

### 3. Iniciar contra el servidor externo

```bash
docker compose -f docker-compose.external.yml up --build -d
docker compose -f docker-compose.external.yml exec backend python check_database.py
```

Si el servidor exige TLS, agregue `?sslmode=require` al final de `DATABASE_URL`.

## Conexión con pgAdmin o DBeaver

La base incluida no publica su puerto por seguridad. Para administrarla temporalmente desde la misma PC:

```bash
docker compose -f docker-compose.yml -f docker-compose.pgadmin.yml up -d
```

Configure el cliente con:

| Campo | Valor predeterminado |
| --- | --- |
| Host | `127.0.0.1` |
| Puerto | `5433` |
| Base | `calidad360` |
| Usuario | `calidad360` |
| Contraseña | valor de `POSTGRES_PASSWORD` |

El puerto solo escucha en la PC local. No utilice el archivo `docker-compose.pgadmin.yml` en un servidor público.

## Migraciones

El contenedor ejecuta automáticamente:

```bash
alembic upgrade head
```

Para verificar la revisión instalada:

```bash
docker compose exec backend alembic current
docker compose exec backend alembic heads
```

Una actualización normal conserva el volumen y aplica las nuevas migraciones. No ejecute `docker compose down -v`, porque `-v` elimina la base persistente.

## Credenciales iniciales

Las cuatro cuentas usan inicialmente el valor de `INITIAL_PASSWORD`.

| Usuario | Rol |
| --- | --- |
| `admin` | Administrador |
| `coordinador` | Coordinador |
| `inspector` | Inspector |
| `revisor` | Revisor |

Cambie las contraseñas desde **Mi perfil** antes de registrar información real.

## Respaldo

El servicio `backup` genera un archivo SQL comprimido al iniciar y cada 24 horas. Para crear uno bajo demanda:

```bash
docker compose run --rm backup python backup.py
```

Para copiar los respaldos del contenedor a la carpeta local `backups`:

```bash
docker compose cp backup:/backups/. ./backups
```

Conserve otra copia fuera del servidor y pruebe mensualmente la restauración en una base vacía. No restaure sobre la base activa.

## Actualización sin pérdida de datos

1. Genere y copie un respaldo.
2. Conserve `.env` y los volúmenes Docker.
3. Reemplace los archivos del proyecto.
4. Ejecute `docker compose build`.
5. Ejecute `docker compose up -d`.
6. Ejecute `docker compose exec backend python check_database.py`.
7. Pruebe acceso, registro, validación, no conformidad, PHVA, lote y reporte.

## HTTPS y acceso desde otros dispositivos

En una red local, abra `http://IP-DEL-SERVIDOR:8080`. En producción, coloque el gateway detrás del proxy HTTPS institucional y actualice `CORS_ORIGINS` con el dominio final, por ejemplo `https://calidad.empresa.pe`. No exponga directamente los puertos 3000, 8000 ni 5432.

## Solución de problemas

| Mensaje o síntoma | Verificación |
| --- | --- |
| `database` no es `postgresql` | Revise `.env` y use el archivo Compose correcto. |
| `password authentication failed` | Confirme usuario, contraseña y codificación de la URL externa. |
| `connection refused` | Revise host, puerto, firewall y `listen_addresses`/`pg_hba.conf`. |
| La API no inicia | Consulte `docker compose logs backend --tail=100`. |
| Faltan tablas | Ejecute `docker compose exec backend alembic upgrade head`. |
| El móvil no abre el sistema | Use la IP del servidor, habilite el puerto 8080 en la red privada y verifique que ambos dispositivos estén en la misma red. |
| El navegador bloquea peticiones | Añada la URL real a `CORS_ORIGINS` y reinicie el backend. |

## Lista de aceptación

- `/api/health` responde `status: ok` y `database: postgresql`.
- `check_database.py` no reporta tablas faltantes.
- Cada rol inicia sesión y solo observa sus opciones autorizadas.
- Un registro nuevo conserva proveedor, transportista, lote, usuario y duración.
- La validación crea código único y firma.
- Una desviación genera no conformidad y puede abrir una acción PHVA.
- El lote muestra su secuencia de eventos.
- Excel y PDF se descargan correctamente.
- Existe un respaldo reciente fuera del servidor.
