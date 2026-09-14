from datetime import datetime, timezone
import re

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app import main
from app.database import get_db
from app.models import CorrectiveAction, NonConformity, QualityRecord, Supplier, User


@pytest.fixture
def real_client(monkeypatch, tmp_path):
    """Exercise an empty real-mode installation without touching local PostgreSQL."""
    engine = create_engine(f"sqlite:///{(tmp_path / 'reports.db').as_posix()}", connect_args={"check_same_thread": False})
    monkeypatch.setattr(main, "engine", engine)
    monkeypatch.setattr(main.settings, "seed_demo_data", False)

    def test_db():
        with Session(engine) as db:
            yield db

    main.app.dependency_overrides[get_db] = test_db
    try:
        with TestClient(main.app) as client:
            response = client.post("/api/auth/login", json={"username": "admin", "password": "Calidad2026!"})
            assert response.status_code == 200
            headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
            yield client, headers, engine
    finally:
        main.app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def assert_pdf(response):
    assert response.status_code == 200, response.text[:200]
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment; filename=reporte_calidad.pdf" == response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF-")
    assert response.content.rstrip().endswith(b"%%EOF")


def test_empty_real_installation_exports_a_valid_pdf(real_client):
    client, headers, _ = real_client
    for endpoint in ("records", "suppliers", "nonconformities", "corrective-actions"):
        assert client.get(f"/api/{endpoint}", headers=headers).json() == []
    assert_pdf(client.get("/api/reports/pdf", headers=headers))
    assert client.get("/api/reports/pdf").status_code == 401


def test_pdf_uses_persisted_records_filters_paginates_and_escapes_text(real_client, monkeypatch):
    client, headers, engine = real_client
    selected_at = datetime(2026, 9, 14, 10, tzinfo=timezone.utc)
    with Session(engine) as db:
        admin = db.scalar(select(User).where(User.username == "admin"))
        supplier = Supplier(code="LOCAL-001", name="Agricultor local", origin="Piura", certification_type="Convencional")
        other_supplier = Supplier(code="LOCAL-002", name="Otro agricultor", origin="Piura", certification_type="Convencional")
        db.add_all([supplier, other_supplier])
        db.flush()
        supplier_id = supplier.id
        for index in range(65):
            db.add(QualityRecord(
                record_code=f"LOCAL-{index:05d}", module_code="FOR-CCD-005", supplier_id=supplier.id,
                payload={"peso_promedio": 164}, conformity_percent=100,
                created_at=selected_at, started_at=selected_at, created_by_id=admin.id,
            ))
        for code, module, supplier_ref, created_at in [
            ("EXCLUDED-SUPPLIER", "FOR-CCD-005", other_supplier.id, selected_at),
            ("EXCLUDED-MODULE", "FOR-CCD-002", supplier.id, selected_at),
            ("EXCLUDED-DATE", "FOR-CCD-005", supplier.id, datetime(2026, 9, 12, tzinfo=timezone.utc)),
        ]:
            db.add(QualityRecord(record_code=code, module_code=module, supplier_id=supplier_ref, payload={}, created_at=created_at, started_at=created_at, created_by_id=admin.id))
        db.add(NonConformity(code="NC-LOCAL", category='Piña <img src="missing.png"/> & limón', severity="Mayor", description="Registro local", detected_by_id=admin.id))
        db.add(CorrectiveAction(code="AC-LOCAL", title="Revisión <b>ácida</b> & selección", plan="Revisar la muestra local", responsible_id=admin.id, due_date=selected_at.date(), created_by_id=admin.id))
        db.commit()

    rendered_codes = []
    renderer = main.render_quality_pdf

    def capture_records(rows, nonconformities, actions, generated_at):
        rendered_codes.extend(row.record_code for row in rows)
        assert [item.code for item in nonconformities] == ["NC-LOCAL"]
        assert [item.code for item in actions] == ["AC-LOCAL"]
        return renderer(rows, nonconformities, actions, generated_at)

    monkeypatch.setattr(main, "render_quality_pdf", capture_records)
    response = client.get("/api/reports/pdf", headers=headers, params={
        "start": "2026-09-14", "end": "2026-09-14", "module_code": "FOR-CCD-005", "supplier_id": supplier_id,
    })
    assert_pdf(response)
    assert len(rendered_codes) == 65
    assert all(code.startswith("LOCAL-") for code in rendered_codes)
    assert len(re.findall(rb"/Type\s*/Page\b", response.content)) >= 2
