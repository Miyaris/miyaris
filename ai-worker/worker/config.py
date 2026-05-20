from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    MIYARIS_API_URL: str = "http://localhost:8000"
    SERVICE_API_KEY: str = Field(min_length=1)

    POLL_INTERVAL_SECONDS: int = 15
    BATCH_SIZE: int = 5
    HTTP_TIMEOUT_SECONDS: float = 30.0

    OLLAMA_BASE_URL: str | None = None
    OLLAMA_MODEL: str = "llama3.1:8b"


@lru_cache
def get_settings() -> Settings:
    return Settings()
