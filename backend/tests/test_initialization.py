import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import Base
from app.main import seed_database, settings
from app.models import (
    Carrier, CatalogItem, CorrectiveAction, LotEvent, NonConformity,
    ProductionLot, QualityParameter, QualityRecord, RolePermission, Supplier, User,
)


def test_real_initialization_has_no_fictional_operations_and_preserves_changes(monkeypatch):
    monkeypatch.setattr(settings, "seed_demo_data", False)
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed_database(db)
        assert db.scalar(select(func.count()).select_from(User)) == 4
        assert db.scalar(select(func.count()).select_from(RolePermission)) > 0
        assert db.scalar(select(func.count()).select_from(CatalogItem)) > 0
        parameter = db.scalar(select(QualityParameter).where(QualityParameter.key == "brix_min"))
        parameter.value = 9
        db.commit()
        seed_database(db)
        assert parameter.value == 9
        assert db.scalar(select(func.count()).select_from(User)) == 4
        for model in (Supplier, Carrier, ProductionLot, LotEvent, NonConformity, CorrectiveAction, QualityRecord):
            assert db.scalar(select(func.count()).select_from(model)) == 0
        monkeypatch.setattr(settings, "seed_demo_data", True)
        seed_database(db)
        seed_database(db)
        assert db.scalar(select(func.count()).select_from(Supplier)) == 4
        assert db.scalar(select(func.count()).select_from(Carrier)) == 2
        assert db.scalar(select(func.count()).select_from(ProductionLot)) == 1
        assert db.scalar(select(func.count()).select_from(NonConformity)) == 1
        assert db.scalar(select(func.count()).select_from(CorrectiveAction)) == 1
    engine.dispose()


def test_demo_data_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv("SEED_DEMO_DATA")
    assert Settings(_env_file=None).seed_demo_data is False


def test_settings_ignore_unrelated_working_directory_env(monkeypatch, tmp_path):
    monkeypatch.delenv("POSTGRES_DB", raising=False)
    expected_database = Settings().postgres_db
    (tmp_path / ".env").write_text("POSTGRES_DB=unrelated_working_directory\n", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    assert Settings().postgres_db == expected_database


@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+psycopg"])
def test_postgres_url_uses_installed_driver_without_changing_credentials(scheme):
    config = Settings(_env_file=None, database_url=f"{scheme}://local:p%40ss%25word@localhost:5433/calidad")
    url = config.sqlalchemy_url
    assert url.drivername == "postgresql+psycopg"
    assert url.password == "p@ss%word"
    assert url.port == 5433
    assert url.database == "calidad"


@pytest.mark.parametrize("password", ["short", "é" * 37])
def test_unusable_initial_password_is_rejected_without_exposing_it(password):
    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None, initial_password=password)
    assert password not in str(error.value)
