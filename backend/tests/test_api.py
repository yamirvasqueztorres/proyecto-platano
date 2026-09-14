import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from app.main import app


def auth(client: TestClient, username="admin") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": "Calidad2026!"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_login_and_roles():
    with TestClient(app) as client:
        admin = auth(client)
        assert client.get("/api/users", headers=admin).status_code == 200
        inspector = auth(client, "inspector")
        assert client.get("/api/users", headers=inspector).status_code == 403


def test_create_and_validate_vehicle_record():
    with TestClient(app) as client:
        inspector = auth(client, "inspector")
        payload = {"fecha_ingreso":"2026-09-03","agricultor":"José Paredes","producto":"Plátano verde","codigo_agricultor":"AGR-014","transportista":"Luis Peña","placa":"P3A-201","tipo":"Convencional", **{f"condicion_{i}":"Ausencia" for i in range(9)}}
        response = client.post("/api/records", headers=inspector, json={"module_code":"FOR-CCD-001","certification_type":"Convencional","payload":payload,"started_at":(datetime.now(timezone.utc)-timedelta(minutes=4)).isoformat()})
        assert response.status_code == 201
        record = response.json()
        assert record["conformity_percent"] == 100
        coordinator = auth(client, "coordinador")
        validated = client.post(f"/api/records/{record['id']}/validate", headers=coordinator, json={"decision":"Aprobado","observations":"Conforme"})
        assert validated.status_code == 200
        assert validated.json()["validation_code"].startswith("VAL-")


def test_weight_is_calculated():
    with TestClient(app) as client:
        headers = auth(client, "inspector")
        payload = {"fecha":"2026-09-03","proveedor":"José Paredes","peso_bruto":44,"jabas":2,"peso_neto":32.8,"unidades":200,"tipo":"Convencional"}
        response = client.post("/api/records", headers=headers, json={"module_code":"FOR-CCD-005","payload":payload,"started_at":(datetime.now(timezone.utc)-timedelta(minutes=2)).isoformat()})
        assert response.status_code == 201
        assert response.json()["payload"]["peso_promedio"] == 164


def test_improvement_workflow_and_lot_traceability():
    with TestClient(app) as client:
        headers = auth(client)
        suffix = uuid.uuid4().hex[:6].upper()
        lot = client.post("/api/lots", headers=headers, json={
            "code": f"LOT-{suffix}", "product": "Plátano verde",
            "certification_type": "Convencional", "quantity_kg": 820,
            "current_stage": "Recepción", "status": "Activo",
        })
        assert lot.status_code == 201, lot.text
        lot_data = lot.json()
        event = client.post(f"/api/lots/{lot_data['id']}/events", headers=headers, json={
            "stage": "Selección", "event_type": "Avance",
            "description": "Clasificación verificada por calidad",
        })
        assert event.status_code == 201

        nc = client.post("/api/nonconformities", headers=headers, json={
            "module_code": "FOR-CCD-018", "lot_code": lot_data["code"],
            "category": "Calibre", "severity": "Mayor",
            "description": "Calibre inferior al objetivo", "quantity": 12,
        })
        assert nc.status_code == 201, nc.text
        alert = next(item for item in client.get("/api/notifications", headers=headers).json() if nc.json()["code"] in item["message"])
        assert client.patch(f"/api/notifications/{alert['id']}/read", headers=headers).status_code == 200
        inspector_headers = auth(client, "inspector")
        inspector_alert = next(item for item in client.get("/api/notifications", headers=inspector_headers).json() if item["id"] == alert["id"])
        assert inspector_alert["is_read"] is False
        admin_id = client.get("/api/users", headers=headers).json()[0]["id"]
        action = client.post("/api/corrective-actions", headers=headers, json={
            "nonconformity_id": nc.json()["id"], "title": "Ajustar selección por calibre",
            "plan": "Aplicar patrón visual antes del pelado", "responsible_id": admin_id,
            "due_date": (datetime.now(timezone.utc) + timedelta(days=5)).date().isoformat(),
        })
        assert action.status_code == 201, action.text
        completed = client.patch(f"/api/corrective-actions/{action.json()['id']}", headers=headers, json={
            "status": "Completada", "check_result": "Muestra conforme",
            "effectiveness_percent": 95,
        })
        assert completed.status_code == 200, completed.text
        assert completed.json()["phase"] == "Actuar"
        detail = client.get(f"/api/lots/{lot_data['id']}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["current_stage"] == "Selección"
        assert detail.json()["open_nonconformities"] == 1


def test_roles_catalogs_profile_and_spc():
    with TestClient(app) as client:
        headers = auth(client)
        roles = client.get("/api/roles", headers=headers)
        assert roles.status_code == 200
        assert any(item["key"] == "phva.manage" for item in roles.json()["permission_catalog"])

        suffix = uuid.uuid4().hex[:6].upper()
        catalog = client.post("/api/catalogs", headers=headers, json={
            "catalog_type": "defecto", "code": f"D{suffix}",
            "name": "Defecto de prueba", "description": "Validación automatizada",
        })
        assert catalog.status_code == 201, catalog.text
        disabled = client.patch(f"/api/catalogs/{catalog.json()['id']}", headers=headers, json={"is_active": False})
        assert disabled.status_code == 200
        assert disabled.json()["is_active"] is False

        profile = client.patch("/api/profile", headers=headers, json={
            "full_name": "Ana Salazar", "email": "ana.salazar@tropical.pe",
        })
        assert profile.status_code == 200
        spc = client.get("/api/spc?field=conformity_percent", headers=headers)
        assert spc.status_code == 200
        assert "ucl" in spc.json() and "points" in spc.json()
        report = client.get("/api/reports/excel", headers=headers)
        assert report.status_code == 200
        assert report.headers["content-type"].startswith("application/vnd.openxmlformats")
        assert len(report.content) > 1000


def test_observation_requires_reason_and_master_links_are_saved():
    with TestClient(app) as client:
        inspector = auth(client, "inspector")
        admin = auth(client)
        supplier = client.get("/api/suppliers", headers=admin).json()[0]
        carrier = client.get("/api/carriers", headers=admin).json()[0]
        payload = {
            "fecha_ingreso": "2026-09-04", "agricultor": supplier["name"],
            "producto": "Plátano verde", "codigo_agricultor": supplier["code"],
            "transportista": carrier["name"], "placa": carrier["plate"] or "P3A-201",
            "tipo": supplier["certification_type"],
            **{f"condicion_{i}": "Ausencia" for i in range(9)},
        }
        created = client.post("/api/records", headers=inspector, json={
            "module_code": "FOR-CCD-001", "supplier_id": supplier["id"],
            "carrier_id": carrier["id"], "certification_type": supplier["certification_type"],
            "payload": payload,
            "started_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
        })
        assert created.status_code == 201, created.text
        assert created.json()["supplier_id"] == supplier["id"]
        rejected = client.post(
            f"/api/records/{created.json()['id']}/validate",
            headers=admin,
            json={"decision": "Observado", "observations": ""},
        )
        assert rejected.status_code == 422


def test_duplicate_user_email_is_rejected_on_update():
    with TestClient(app) as client:
        headers = auth(client)
        users = client.get("/api/users", headers=headers).json()
        admin_user = next(item for item in users if item["username"] == "admin")
        inspector = next(item for item in users if item["username"] == "inspector")
        response = client.patch(
            f"/api/users/{inspector['id']}",
            headers=headers,
            json={"email": admin_user["email"]},
        )
        assert response.status_code == 409


def test_numeric_form_values_feed_spc_and_status_filter():
    with TestClient(app) as client:
        inspector = auth(client, "inspector")
        payload = {
            "fecha_cosecha": "2026-09-03", "fecha_ingreso": "2026-09-04",
            "hora": "08:30", "proveedor_codigo": "AGR-014",
            "proveedor": "José Paredes", "brix": "11.5", "humedad": "65",
            "bpa_vehiculo": "Cumple", "bpa_materia": "Cumple",
            "peso_promedio": "164", "tipo": "Convencional",
        }
        created = client.post("/api/records", headers=inspector, json={
            "module_code": "FOR-CCD-002", "payload": payload,
            "started_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
        })
        assert created.status_code == 201, created.text
        assert created.json()["payload"]["brix"] == 11.5
        admin = auth(client)
        spc = client.get("/api/spc?module_code=FOR-CCD-002&field=brix", headers=admin)
        assert spc.status_code == 200
        assert spc.json()["count"] >= 1
        filtered = client.get("/api/records?status=Pendiente", headers=admin)
        assert filtered.status_code == 200
        assert all(item["status"] == "Pendiente" for item in filtered.json())


def test_create_supplier_normalizes_code_and_rejects_duplicates():
    with TestClient(app) as client:
        headers = auth(client)
        code = f"agr-{uuid.uuid4().hex[:8]}"
        payload = {
            "code": code, "name": "Proveedor registrado localmente",
            "origin": "Piura", "certification_type": "Convencional",
        }
        created = client.post("/api/suppliers", headers=headers, json=payload)
        assert created.status_code == 201, created.text
        assert created.json()["code"] == code.upper()
        persisted = client.get(f"/api/suppliers?q={code}", headers=headers)
        assert any(item["id"] == created.json()["id"] for item in persisted.json())
        duplicate = client.post("/api/suppliers", headers=headers, json=payload)
        assert duplicate.status_code == 409


@pytest.mark.parametrize("invalid", [
    {"supplier_id": 2147483647},
    {"carrier_id": 2147483647},
    {"started_at": "2026-09-04T08:00:00"},
])
def test_records_reject_missing_master_data_and_ambiguous_start_time(invalid):
    with TestClient(app) as client:
        headers = auth(client, "inspector")
        body = {
            "module_code": "FOR-CCD-005",
            "payload": {"fecha": "2026-09-04", "proveedor": "Proveedor local", "peso_bruto": 44, "jabas": 2, "peso_neto": 32.8, "unidades": 200, "tipo": "Convencional"},
            "started_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
            **invalid,
        }
        response = client.post("/api/records", headers=headers, json=body)
        assert response.status_code == 422, response.text


def test_record_lot_normalization_preserves_traceability():
    with TestClient(app) as client:
        headers = auth(client)
        lot_code = f"local-{uuid.uuid4().hex[:8]}"
        created = client.post("/api/records", headers=headers, json={
            "module_code": "FOR-CCD-005", "lot": f" {lot_code} ",
            "payload": {"fecha": "2026-09-04", "proveedor": "Proveedor local", "peso_bruto": 44, "jabas": 2, "peso_neto": 32.8, "unidades": 200, "tipo": "Convencional"},
            "started_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
        })
        assert created.status_code == 201, created.text
        assert created.json()["lot"] == lot_code.upper()
        lots = client.get("/api/lots", headers=headers).json()
        lot = next(item for item in lots if item["code"] == lot_code.upper())
        detail = client.get(f"/api/lots/{lot['id']}", headers=headers).json()
        assert detail["record_count"] == 1
        assert detail["records"][0]["id"] == created.json()["id"]
