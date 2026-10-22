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
    api_requests_per_minute: int | None = None

    @classmethod
    def from_environment(cls) -> "Settings":
        raw_origins = os.getenv("WEATHER_CORS_ORIGINS")
        origins = (
            DEFAULT_CORS_ORIGINS
            if raw_origins is None
            else tuple(origin.strip() for origin in raw_origins.split(",") if origin.strip())
        )
        raw_rate_limit = os.getenv("WEATHER_API_RATE_LIMIT_PER_MINUTE")
        rate_limit = None
        if raw_rate_limit is not None:
            try:
                rate_limit = int(raw_rate_limit)
            except ValueError as exc:
                raise ValueError(
                    "WEATHER_API_RATE_LIMIT_PER_MINUTE must be a positive integer"
                ) from exc
            if rate_limit < 1:
                raise ValueError(
                    "WEATHER_API_RATE_LIMIT_PER_MINUTE must be a positive integer"
                )

        return cls(
            cors_origins=origins,
            api_requests_per_minute=rate_limit,
        )
