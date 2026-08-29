from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class ApiModel(BaseModel):
    """Shared API contract defaults.

    Rejecting unknown fields keeps provider-shape changes from leaking through the
    public API unnoticed.
    """

    model_config = ConfigDict(extra="forbid")


class HealthResponse(ApiModel):
    status: Literal["ok"]


class CurrentWeather(ApiModel):
    location: str
    temperature: float
    apparent_temperature: float
    humidity: int
    wind_speed: float
    weather_code: int
    time: str


class HourlyWeather(ApiModel):
    time: str
    temperature: float
    precipitation: float
    weather_code: int
    wind_speed: float


class RainEvent(ApiModel):
    start_time: str
    end_time: str
    total_precipitation: float
    peak_time: str


class WeatherOverview(ApiModel):
    current: CurrentWeather
    hourly: list[HourlyWeather]
    next_rain: Optional[RainEvent]


class LocationSearchResult(ApiModel):
    name: str
    latitude: float
    longitude: float
    admin1: Optional[str]
    country: str
