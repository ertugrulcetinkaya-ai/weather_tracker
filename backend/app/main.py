from __future__ import annotations

import logging
from collections import OrderedDict, deque
from math import ceil
from threading import Lock
from time import monotonic
from typing import Optional

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

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


class _SlidingWindowRateLimiter:
    MAX_TRACKED_CLIENTS = 4096

    def __init__(self, limit: int, window_seconds: int = 60) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._requests: OrderedDict[str, deque[float]] = OrderedDict()
        self._last_cleanup = monotonic()
        self._lock = Lock()

    def allow(self, client_id: str) -> tuple[bool, int]:
        now = monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            if now - self._last_cleanup >= self.window_seconds:
                for key, timestamps in tuple(self._requests.items()):
                    while timestamps and timestamps[0] <= cutoff:
                        timestamps.popleft()
                    if not timestamps:
                        del self._requests[key]
                self._last_cleanup = now

            timestamps = self._requests.get(client_id)
            if timestamps is None:
                if len(self._requests) >= self.MAX_TRACKED_CLIENTS:
                    self._requests.popitem(last=False)
                timestamps = deque()
                self._requests[client_id] = timestamps
            else:
                self._requests.move_to_end(client_id)
            while timestamps and timestamps[0] <= cutoff:
                timestamps.popleft()
            if len(timestamps) >= self.limit:
                retry_after = max(1, ceil(self.window_seconds - (now - timestamps[0])))
                return False, retry_after

            timestamps.append(now)
            return True, 0


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
    rate_limiter = (
        _SlidingWindowRateLimiter(resolved.api_requests_per_minute)
        if resolved.api_requests_per_minute is not None
        else None
    )

    if resolved.cors_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=list(resolved.cors_origins),
            allow_credentials=False,
            allow_methods=["GET"],
            allow_headers=["*"],
        )

    @application.middleware("http")
    async def limit_public_api_requests(request: Request, call_next):
        path = request.url.path
        if resolved.enforce_https and request.url.scheme != "https" and path != "/health":
            return RedirectResponse(str(request.url.replace(scheme="https")), status_code=307)

        is_provider_endpoint = path.startswith("/weather/") or path == "/locations/search"
        if not is_provider_endpoint:
            return await call_next(request)

        if rate_limiter is not None:
            client_id = request.client.host if request.client is not None else "unknown"
            allowed, retry_after = rate_limiter.allow(client_id)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again shortly."},
                    headers={"Retry-After": str(retry_after)},
                )
        return await call_next(request)

    @application.exception_handler(WeatherFetchError)
    async def weather_fetch_error_handler(
        request: Request,
        exc: WeatherFetchError,
    ) -> JSONResponse:
        logger.warning(
            "Weather provider request failed on %s (%s)",
            request.url.path,
            type(exc).__name__,
        )
        return JSONResponse(
            status_code=502,
            content={"detail": "Weather data is temporarily unavailable."},
        )

    application.include_router(router)
    return application


app = create_app()
