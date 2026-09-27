from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://siteflow:siteflow@localhost:5432/siteflow"
    jwt_secret: str = "change-me-in-env"
    jwt_expire_minutes: int = 720
    # Uploaded photos and video. "local" stores files under media_dir; S3 comes later.
    storage_backend: str = "local"
    media_dir: str = str(Path(__file__).resolve().parents[1] / "media")
    # Web console dev server, the built www/ served locally, and the Capacitor Android WebView.
    cors_origins: list[str] = [
        "http://localhost",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "capacitor://localhost",
        "https://localhost",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
