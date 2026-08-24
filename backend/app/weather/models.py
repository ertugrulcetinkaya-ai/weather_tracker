from pydantic import BaseModel


class CurrentWeather(BaseModel):
    location: str
    temperature: float
    apparent_temperature: float
    humidity: int
    wind_speed: float
    weather_code: int
    time: str
