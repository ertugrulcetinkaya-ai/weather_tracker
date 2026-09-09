import type {
  CurrentWeather,
  DailyWeather,
  HourlyWeather,
  RainEvent,
  WeatherOverview,
} from '../types/weather';

type JsonRecord = Record<string, unknown>;

const HOURLY_RECORD_COUNT = 24;
const DAILY_RECORD_COUNT = 7;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isProbability(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0 && value <= 100;
}

function parseCurrentWeather(value: unknown): CurrentWeather {
  if (
    !isRecord(value) ||
    typeof value.location !== 'string' ||
    !isFiniteNumber(value.temperature) ||
    !isFiniteNumber(value.apparent_temperature) ||
    !isFiniteNumber(value.humidity) ||
    !isFiniteNumber(value.wind_speed) ||
    !isFiniteNumber(value.weather_code) ||
    typeof value.time !== 'string'
  ) {
    throw new Error('Unexpected current weather response');
  }
  return {
    location: value.location,
    temperature: value.temperature,
    apparent_temperature: value.apparent_temperature,
    humidity: value.humidity,
    wind_speed: value.wind_speed,
    weather_code: value.weather_code,
    time: value.time,
  };
}

function parseHourlyWeather(value: unknown): HourlyWeather {
  if (
    !isRecord(value) ||
    typeof value.time !== 'string' ||
    !isFiniteNumber(value.temperature) ||
    !isFiniteNumber(value.precipitation) ||
    !isProbability(value.precipitation_probability) ||
    !isFiniteNumber(value.weather_code) ||
    !isFiniteNumber(value.wind_speed)
  ) {
    throw new Error('Unexpected hourly weather response');
  }
  return {
    time: value.time,
    temperature: value.temperature,
    precipitation: value.precipitation,
    precipitation_probability: value.precipitation_probability,
    weather_code: value.weather_code,
    wind_speed: value.wind_speed,
  };
}

function parseDailyWeather(value: unknown): DailyWeather {
  if (
    !isRecord(value) ||
    typeof value.date !== 'string' ||
    value.date.trim() === '' ||
    !isFiniteNumber(value.temperature_max) ||
    !isFiniteNumber(value.temperature_min) ||
    !isFiniteNumber(value.precipitation) ||
    !isProbability(value.precipitation_probability) ||
    !isFiniteNumber(value.weather_code)
  ) {
    throw new Error('Unexpected daily weather response');
  }
  return {
    date: value.date,
    temperature_max: value.temperature_max,
    temperature_min: value.temperature_min,
    precipitation: value.precipitation,
    precipitation_probability: value.precipitation_probability,
    weather_code: value.weather_code,
  };
}

function parseRainEvent(value: unknown): RainEvent {
  if (
    !isRecord(value) ||
    typeof value.start_time !== 'string' ||
    typeof value.end_time !== 'string' ||
    !isFiniteNumber(value.total_precipitation) ||
    typeof value.peak_time !== 'string'
  ) {
    throw new Error('Unexpected rain event response');
  }
  return {
    start_time: value.start_time,
    end_time: value.end_time,
    total_precipitation: value.total_precipitation,
    peak_time: value.peak_time,
  };
}

export function parseWeatherOverview(value: unknown): WeatherOverview {
  if (
    !isRecord(value) ||
    !Array.isArray(value.hourly) ||
    value.hourly.length !== HOURLY_RECORD_COUNT ||
    !Array.isArray(value.daily) ||
    value.daily.length !== DAILY_RECORD_COUNT
  ) {
    throw new Error('Unexpected weather overview response');
  }
  const hourly = value.hourly;
  const daily = value.daily;
  const nextRain = value.next_rain;
  return {
    current: parseCurrentWeather(value.current),
    hourly: hourly.map(parseHourlyWeather),
    daily: daily.map(parseDailyWeather),
    next_rain: nextRain === null ? null : parseRainEvent(nextRain),
  };
}
