from functools import lru_cache
from pathlib import Path
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    app_name: str = "Calidad 360"
    environment: str = "development"
    secret_key: str = "cambiar-esta-clave-en-produccion-2026"
    access_token_minutes: int = Field(default=480, gt=0)
    database_url: str | None = None
    postgres_db: str = "calidad360"
    postgres_user: str = "calidad360"
    postgres_password: str = "calidad360"
    postgres_host: str = "localhost"
    postgres_port: int = Field(default=5432, ge=1, le=65535)
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    retention_years: int = Field(default=3, ge=1)
    initial_password: str = Field(default="Calidad2026!", min_length=10)
    seed_demo_data: bool = False
    backup_dir: str = "./backups"
    pg_dump_path: str | None = None
    model_config = SettingsConfigDict(
        env_file=(PROJECT_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    @field_validator("initial_password")
    @classmethod
    def validate_initial_password(cls, password: str) -> str:
        # bcrypt uses at most 72 bytes, including multi-byte Unicode characters.
        if len(password.encode("utf-8")) > 72:
            raise ValueError("INITIAL_PASSWORD debe ocupar como máximo 72 bytes UTF-8")
        return password

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlalchemy_url(self) -> str | URL:
        if self.database_url:
            url = make_url(self.database_url)
            if url.drivername in {"postgres", "postgresql"}:
                url = url.set(drivername="postgresql+psycopg")
            return url
        return URL.create(
            "postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
