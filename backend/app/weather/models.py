from pydantic import BaseModel


class CurrentWeather(BaseModel):
    location: str
    temperature: float
    apparent_temperature: float
    humidity: int
    wind_speed: float
    weather_code: int
    time: str


class HourlyWeather(BaseModel):
    time: str
    temperature: float
    precipitation: float
    weather_code: int
    wind_speed: float


class RainEvent(BaseModel):
    start_time: str
    end_time: str
    total_precipitation: float
    peak_time: str


class LocationSearchResult(BaseModel):
    name: str
    latitude: float
    longitude: float
    admin1: str | None
    country: str
