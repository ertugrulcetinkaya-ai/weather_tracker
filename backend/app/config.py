from __future__ import annotations

import os
from dataclasses import dataclass

DEFAULT_CORS_ORIGINS = (
    "http://localhost:8081",
    "http://127.0.0.1:8081",
)


@dataclass(frozen=True)
class Settings:
    app_name: str = "Weather Tracker API"
    app_version: str = "1.1.0"
    cors_origins: tuple[str, ...] = DEFAULT_CORS_ORIGINS

    @classmethod
    def from_environment(cls) -> "Settings":
        raw_origins = os.getenv("WEATHER_CORS_ORIGINS")
        if raw_origins is None:
            return cls()
        origins = tuple(
            origin.strip() for origin in raw_origins.split(",") if origin.strip()
        )
        return cls(cors_origins=origins)
