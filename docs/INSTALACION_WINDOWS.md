# Instalación en una PC o servidor Windows

## Opción recomendada: Docker Desktop

1. Instale Docker Desktop y active WSL 2.
2. Descomprima el proyecto en una carpeta sin caracteres especiales.
3. Copie `.env.example` como `.env`.
4. Reemplace `POSTGRES_PASSWORD` y `SECRET_KEY` con valores seguros.
5. Abra PowerShell en la carpeta y ejecute `docker compose up --build -d`.
6. Espere a que los servicios estén saludables y abra `http://localhost:8080`.

Verifique desde PowerShell:

```powershell
docker compose ps
Invoke-RestMethod http://localhost:8080/api/health
docker compose exec backend python check_database.py
```

La respuesta debe indicar `status: ok` y `database: postgresql`.

Si utilizará una base PostgreSQL institucional en vez del contenedor incluido, configure `DATABASE_URL` y ejecute `docker compose -f docker-compose.external.yml up --build -d`. La guía completa, incluida la conexión con pgAdmin o DBeaver, está en `docs/DESPLIEGUE_POSTGRESQL.md`.

Para entrar desde otro equipo de la misma red, identifique la IPv4 del servidor con `ipconfig` y use `http://IP-DEL-SERVIDOR:8080`. Autorice el puerto 8080 en el Firewall de Windows solo para la red privada.

## Puesta en producción

- Publique mediante HTTPS; no exponga directamente los puertos 3000, 5432 ni 8000.
- Reemplace las cuatro contraseñas iniciales.
- Restrinja el puerto 8080 a la red institucional o coloque un proxy TLS frontal.
- Verifique el volumen `calidad_backups` y copie respaldos a un destino externo.
- Configure monitoreo del endpoint `/api/health`.
- Pruebe el flujo completo con cada rol antes de registrar producción real.
- Programe la copia del volumen `calidad_backups` hacia otro equipo o almacenamiento institucional.

## Actualización

Conserve `.env` y los volúmenes. Reemplace el código, ejecute `docker compose build` y luego `docker compose up -d`. Realice un respaldo manual antes de actualizar.

Para forzar un respaldo antes de la actualización:

```powershell
docker compose run --rm backup python backup.py
```

## Detener sin borrar datos

Use `docker compose down`. No agregue `-v`, porque esa opción elimina los volúmenes de base de datos y respaldo.
