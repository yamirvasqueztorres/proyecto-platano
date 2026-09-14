# Matriz de cumplimiento

| Requisito | Implementación | Evidencia principal |
| --- | --- | --- |
| RF-001 Autenticación | JWT, bcrypt, expiración y bloqueo de cuentas | `backend/app/auth.py` |
| RF-002 Usuarios | Alta, edición, cambio de rol y activación/desactivación | `/api/users` |
| RF-003 Ocho módulos | Formularios CCD-001, 002, 005, 007, 010, 018, 019 y 023 | `app/quality-app.tsx` y `module_catalog.py` |
| RF-004 Validaciones | Obligatorios, tipos, totales, rangos y límites de defectos | `validate_quality_payload()` |
| RF-005 Listas permanentes | Proveedores y transportistas administrables, seleccionables en captura y vinculados por identificador | `/api/suppliers`, `/api/carriers`, `RegisterDialog` |
| RF-006 Dashboard | Conformidad, peso, pendientes, tiempos, tendencias y Pareto | `/api/dashboard` |
| RF-007 Firma/código | Código único y firma HMAC SHA-256 vinculada al aprobador | `/api/records/{id}/validate` |
| RF-008 Reportes | Excel XLSX y PDF filtrables | `/api/reports/excel`, `/api/reports/pdf` |
| RF-009 Tiempo | Inicio, fin y duración en segundos | `QualityRecord` |
| RF-010 Notificaciones | Eventos de registro y validación; lectura individual | `/api/notifications` |
| RF-011 Históricos | Importación Excel/CSV y retención configurable | `/api/import/records` |
| RF-012 No conformidades | Alta, severidad, causa raíz, disposición, estados y cierre controlado | `/api/nonconformities` |
| RF-013 Acciones PHVA | Planificar, Hacer, Verificar, Actuar, responsables, plazos y eficacia | `/api/corrective-actions` |
| RF-014 SPC | Media, desviación, LCI/LCS, Cp/Cpk y puntos fuera de control | `/api/spc` |
| RF-015 Lotes | Cadena de eventos, etapas, registros, retención y liberación | `/api/lots` |
| RF-016 Roles configurables | Matriz persistente y autorización aplicada por la API | `/api/roles` y `require_permission()` |
| RF-017 Catálogos | Productos, defectos, etapas y turnos con activación/desactivación | `/api/catalogs` |
| RF-018 Perfil | Edición de datos y cambio de contraseña verificada | `/api/profile` |
| RF-019 Alertas | Niveles, destinatarios, lectura individual y lectura masiva | `/api/notifications` |
| RNF-001 Disponibilidad | Contenedores reiniciables y health checks de base, API, web y gateway | `docker-compose.yml` |
| RNF-002 Recuperación | Respaldo al iniciar y cada 24 horas | servicio `backup` |
| RNF-003 Rendimiento | Índices por módulo, estado, fecha, proveedor, lote, severidad y plazos | `models.py` |
| RNF-004 Escalabilidad | Catálogo de módulos y payload JSON extensible | `module_catalog.py` |
| RNF-005 Seguridad | JWT, RBAC, bcrypt, HMAC, validación y consultas parametrizadas | backend Python |
| RNF-006 Multiplataforma | Layouts para escritorio, tablet y móvil; controles táctiles | `globals.css` |
| RNF-007 Usabilidad | Formularios por pasos, mensajes, filtros y estados | interfaz React |
| RNF-008 Mantenibilidad | Capas de configuración, datos, modelos, esquemas, seguridad y reglas | `backend/app/` |
| RNF-009 Trazabilidad | Acción, usuario, entidad, IP, fecha y detalle | `AuditLog` y `/api/audit` |

## Reglas antes de producción

1. Validar con Control de Calidad los rangos de °Brix, humedad, temperatura y pesos.
2. Sustituir las claves incluidas en `.env.example`.
3. Cambiar las contraseñas iniciales y desactivar cuentas no utilizadas.
4. Configurar HTTPS y comprobar la restauración de un respaldo.
5. Ejecutar una prueba de aceptación con al menos un registro completo por módulo y por rol.
6. Confirmar que `/api/health` informa `database: postgresql`.
7. Ejecutar `python check_database.py` y confirmar que no existen tablas faltantes.
