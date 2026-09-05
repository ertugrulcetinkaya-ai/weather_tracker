from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Settings
from app.weather.models import (
    CurrentWeather,
    HealthResponse,
    HourlyWeather,
    LocationSearchResult,
    RainEvent,
    WeatherOverview,
)
from app.weather.open_meteo import (
    ELAZIG_LATITUDE,
    ELAZIG_LOCATION,
    ELAZIG_LONGITUDE,
    WeatherFetchError,
    fetch_hourly_weather,
    get_current_weather,
    get_next_rain,
    get_weather_overview,
    search_locations,
)
from app.weather.rain import find_rain_events

logger = logging.getLogger(__name__)
router = APIRouter()


def _validate_coords(
    latitude: Optional[float],
    longitude: Optional[float],
) -> tuple[float, float]:
    if (latitude is None) != (longitude is None):
        raise HTTPException(
            status_code=422,
            detail="latitude and longitude must be provided together",
        )
    if latitude is not None:
        assert longitude is not None
        return latitude, longitude
    return ELAZIG_LATITUDE, ELAZIG_LONGITUDE


def _location_name(location: Optional[str]) -> str:
    if location is None:
        return ELAZIG_LOCATION
    normalized = location.strip()
    if not normalized:
        raise HTTPException(status_code=422, detail="location must not be blank")
    return normalized


@router.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get(
    "/locations/search",
    response_model=list[LocationSearchResult],
    tags=["locations"],
)
def locations_search(
    q: str = Query(..., min_length=2, max_length=100),
) -> list[LocationSearchResult]:
    normalized = q.strip()
    if len(normalized) < 2:
        raise HTTPException(status_code=422, detail="q must contain at least 2 characters")
    return search_locations(normalized)


@router.get("/weather/current", response_model=CurrentWeather, tags=["weather"])
def weather_current(
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    location: Optional[str] = Query(None, min_length=1, max_length=120),
) -> CurrentWeather:
    lat, lon = _validate_coords(latitude, longitude)
    loc = _location_name(location)
    return get_current_weather(latitude=lat, longitude=lon, location=loc)


@router.get(
    "/weather/hourly",
    response_model=list[HourlyWeather],
    tags=["weather"],
)
def weather_hourly(
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
) -> list[HourlyWeather]:
    lat, lon = _validate_coords(latitude, longitude)
    return fetch_hourly_weather(latitude=lat, longitude=lon)


@router.get(
    "/weather/overview",
    response_model=WeatherOverview,
    tags=["weather"],
)
def weather_overview(
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    location: Optional[str] = Query(None, min_length=1, max_length=120),
) -> WeatherOverview:
    lat, lon = _validate_coords(latitude, longitude)
    loc = _location_name(location)
    return get_weather_overview(latitude=lat, longitude=lon, location=loc)


@router.get("/weather/rain", response_model=list[RainEvent], tags=["weather"])
def weather_rain(
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
) -> list[RainEvent]:
    lat, lon = _validate_coords(latitude, longitude)
    hourly = fetch_hourly_weather(latitude=lat, longitude=lon)
    return find_rain_events(hourly)


@router.get("/weather/rain/next", response_model=Optional[RainEvent], tags=["weather"])
def weather_rain_next(
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
) -> Optional[RainEvent]:
    lat, lon = _validate_coords(latitude, longitude)
    return get_next_rain(latitude=lat, longitude=lon)


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    resolved = settings or Settings.from_environment()
    application = FastAPI(
        title=resolved.app_name,
        version=resolved.app_version,
        description="Weather data optimized for the Weather Tracker mobile client.",
    )
    if resolved.cors_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=list(resolved.cors_origins),
            allow_credentials=False,
            allow_methods=["GET"],
            allow_headers=["*"],
        )

    @application.exception_handler(WeatherFetchError)
    async def weather_fetch_error_handler(
        request: Request,
        exc: WeatherFetchError,
    ) -> JSONResponse:
        logger.warning("Weather provider failure on %s: %s", request.url.path, exc)
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    application.include_router(router)
    return application


app = create_app()
