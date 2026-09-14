from typing import Any

MODULES = {
    "FOR-CCD-001": {"name": "Inspección de vehículos", "required": ["fecha_ingreso", "agricultor", "producto", "codigo_agricultor", "transportista", "placa", "tipo"]},
    "FOR-CCD-002": {"name": "Control de materia prima", "required": ["fecha_cosecha", "fecha_ingreso", "hora", "proveedor_codigo", "proveedor", "brix", "humedad", "bpa_vehiculo", "bpa_materia", "peso_promedio", "tipo"]},
    "FOR-CCD-005": {"name": "Peso promedio por unidad", "required": ["fecha", "proveedor", "peso_bruto", "jabas", "peso_neto", "unidades", "tipo"]},
    "FOR-CCD-007": {"name": "Control de calidad en pelado", "required": ["fecha", "hora", "proveedor_codigo", "pelador_codigo", "brix", "muestra", "conforme", "defectos", "tipo"]},
    "FOR-CCD-010": {"name": "Control de descarte", "required": ["fecha", "hora", "codigo", "kg", "total", "conforme", "tipo"]},
    "FOR-CCD-018": {"name": "Selección de materia prima pelada", "required": ["fecha", "hora", "codigo", "calidad", "total", "operario", "tipo"]},
    "FOR-CCD-019": {"name": "Control de calidad en embolsado", "required": ["producto", "fecha", "hora", "proveedor_codigo", "calidad", "lote", "temperatura", "muestra", "conforme", "defectos", "tipo"]},
    "FOR-CCD-023": {"name": "Control de producto terminado", "required": ["fecha", "hora", "tipo", "agricultor_codigo", "brix", "temperatura", "caracteristica_0", "caracteristica_1", "caracteristica_2", "caracteristica_3"]},
}

DEFECT_LIMITS = {
    "FOR-CCD-007": {"defecto_0": 5.0, "defecto_1": 0.0, "defecto_2": 1.0, "defecto_3": 1.0, "defecto_4": 1.0, "defecto_5": 0.0, "defecto_6": 0.0, "defecto_7": 1.0, "defecto_8": 0.0, "defecto_9": 1.0, "defecto_10": 1.0, "defecto_11": 0.5, "defecto_12": 1.0, "defecto_13": 0.5, "defecto_14": 0.0},
    "FOR-CCD-019": {"defecto_0": 5.0, "defecto_1": 0.0, "defecto_2": 1.0, "defecto_3": 1.0, "defecto_4": 1.0, "defecto_5": 1.0, "defecto_6": 0.0},
}

NUMERIC_FIELDS = {
    "cantidad", "brix", "humedad", "calidad_1", "calidad_2", "calidad_3",
    "peso_promedio", "peso_raquiz", "peso_bruto", "jabas", "peso_neto",
    "unidades", "muestra", "conforme", "defectos", "kg", "total", "primera",
    "segunda", "tercera", "no_conformes", "desviacion", "temperatura", "inferior",
}


def _numeric(payload: dict[str, Any], key: str) -> float:
    try:
        return float(payload.get(key) or 0)
    except (TypeError, ValueError):
        raise ValueError(f"El campo '{key}' debe ser numérico")


def validate_quality_payload(module_code: str, payload: dict[str, Any], parameters: dict[str, float]) -> tuple[float | None, list[str], dict[str, Any]]:
    module = MODULES.get(module_code)
    if not module:
        raise ValueError("Código de módulo no reconocido")
    missing = [key for key in module["required"] if payload.get(key) in (None, "")]
    if missing:
        raise ValueError("Campos obligatorios faltantes: " + ", ".join(missing))
    for key, value in payload.items():
        if key.startswith(("defecto_", "nc_", "calidad_")) and _numeric(payload, key) < 0:
            raise ValueError(f"El campo '{key}' no puede ser negativo")

    alerts: list[str] = []
    conformity: float | None = None
    computed = dict(payload)
    for key, value in payload.items():
        if value not in (None, "") and (key in NUMERIC_FIELDS or key.startswith(("defecto_", "nc_"))):
            computed[key] = _numeric(payload, key)

    if module_code == "FOR-CCD-005":
        units = _numeric(payload, "unidades")
        if units <= 0:
            raise ValueError("El número de unidades debe ser mayor que cero")
        computed["peso_promedio"] = round(_numeric(payload, "peso_neto") * 1000 / units, 2)
        if computed["peso_promedio"] < parameters.get("peso_primera_min", 151):
            alerts.append("El peso promedio es inferior al mínimo configurado para primera calidad")

    if module_code in ("FOR-CCD-007", "FOR-CCD-019"):
        sample, conforming, total_defects = (_numeric(payload, key) for key in ("muestra", "conforme", "defectos"))
        if sample <= 0 or conforming > sample or total_defects > sample:
            raise ValueError("Los totales de muestra, conformes y defectos son inconsistentes")
        conformity = round(conforming * 100 / sample, 2)
        for key, limit in DEFECT_LIMITS[module_code].items():
            incidence = _numeric(payload, key) * 100 / sample
            if incidence > limit:
                alerts.append(f"{key} supera el límite de {limit:g}% ({incidence:.2f}%)")

    if module_code == "FOR-CCD-010":
        total, conforming = _numeric(payload, "total"), _numeric(payload, "conforme")
        if total <= 0 or conforming > total:
            raise ValueError("Los totales de descarte son inconsistentes")
        conformity = round(conforming * 100 / total, 2)

    if module_code == "FOR-CCD-018":
        total = _numeric(payload, "total")
        accepted = sum(_numeric(payload, key) for key in ("primera", "segunda", "tercera"))
        if total <= 0 or accepted > total:
            raise ValueError("La distribución de calidades supera el total evaluado")
        computed["no_conformes"] = round((total - accepted) * 100 / total, 2)
        conformity = round(accepted * 100 / total, 2)

    if module_code == "FOR-CCD-001":
        incidences = [value for key, value in payload.items() if key.startswith("condicion_") and value == "Presencia"]
        conformity = 100.0 if not incidences else 0.0
        if incidences:
            alerts.append("Se detectó al menos una condición no conforme en el vehículo")

    if module_code == "FOR-CCD-002":
        brix, humidity = _numeric(payload, "brix"), _numeric(payload, "humedad")
        if not parameters.get("brix_min", 7) <= brix <= parameters.get("brix_max", 15): alerts.append("°Brix fuera del rango configurado")
        if not parameters.get("humedad_min", 55) <= humidity <= parameters.get("humedad_max", 75): alerts.append("Humedad fuera del rango configurado")
        conformity = 100.0 if not alerts else 0.0

    if module_code == "FOR-CCD-023":
        conformity = 100.0 if all(payload.get(f"caracteristica_{i}") == "Conforme" for i in range(4)) else 0.0
        if conformity == 0: alerts.append("Una o más características del producto terminado son no conformes")

    return conformity, alerts, computed
