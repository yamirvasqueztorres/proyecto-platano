from .models import Role


PERMISSIONS = [
    ("dashboard.view", "Ver resumen e indicadores"),
    ("records.view", "Consultar registros de calidad"),
    ("records.create", "Crear registros de calidad"),
    ("records.validate", "Aprobar, observar o rechazar registros"),
    ("records.import", "Importar históricos Excel/CSV"),
    ("nonconformities.manage", "Gestionar no conformidades"),
    ("phva.manage", "Gestionar acciones correctivas PHVA"),
    ("spc.view", "Consultar análisis estadístico SPC"),
    ("lots.manage", "Gestionar trazabilidad de lotes"),
    ("reports.export", "Generar y exportar reportes"),
    ("alerts.view", "Consultar alertas y notificaciones"),
    ("users.manage", "Administrar usuarios"),
    ("roles.manage", "Configurar roles y permisos"),
    ("catalogs.manage", "Administrar catálogos maestros"),
    ("parameters.manage", "Modificar parámetros de calidad"),
    ("audit.view", "Consultar bitácora de auditoría"),
]

ALL_PERMISSION_KEYS = {key for key, _ in PERMISSIONS}

DEFAULT_ROLE_PERMISSIONS: dict[Role, set[str]] = {
    Role.ADMINISTRADOR: set(ALL_PERMISSION_KEYS),
    Role.COORDINADOR: {
        "dashboard.view", "records.view", "records.create", "records.validate", "records.import",
        "nonconformities.manage", "phva.manage", "spc.view", "lots.manage", "reports.export",
        "alerts.view", "catalogs.manage", "parameters.manage", "audit.view",
    },
    Role.INSPECTOR: {
        "dashboard.view", "records.view", "records.create", "nonconformities.manage",
        "lots.manage", "alerts.view",
    },
    Role.REVISOR: {
        "dashboard.view", "records.view", "spc.view", "reports.export", "alerts.view", "audit.view",
    },
}
