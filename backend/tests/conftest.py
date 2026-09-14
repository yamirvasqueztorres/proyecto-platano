"""Keep tests independent from local PostgreSQL settings and application data."""

import os
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest


_test_directory = TemporaryDirectory(prefix="calidad360-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_test_directory.name, 'test.db').as_posix()}"
os.environ["ENVIRONMENT"] = "testing"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["INITIAL_PASSWORD"] = "Calidad2026!"
os.environ["SEED_DEMO_DATA"] = "true"


@pytest.fixture(scope="session", autouse=True)
def isolated_database():
    yield
    from app.database import engine

    engine.dispose()
    _test_directory.cleanup()
