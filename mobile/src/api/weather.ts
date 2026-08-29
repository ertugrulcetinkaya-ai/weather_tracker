import type {
  CurrentWeather,
  HourlyWeather,
  LocationSearchResult,
  RainEvent,
  WeatherLocation,
  WeatherOverview,
} from '../types/weather';

import { requestJson } from './client';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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
  return value as CurrentWeather;
}

function parseHourlyWeather(value: unknown): HourlyWeather {
  if (
    !isRecord(value) ||
    typeof value.time !== 'string' ||
    !isFiniteNumber(value.temperature) ||
    !isFiniteNumber(value.precipitation) ||
    !isFiniteNumber(value.weather_code) ||
    !isFiniteNumber(value.wind_speed)
  ) {
    throw new Error('Unexpected hourly weather response');
  }
  return value as HourlyWeather;
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
  return value as RainEvent;
}

function parseLocation(value: unknown): LocationSearchResult {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    !isFiniteNumber(value.latitude) ||
    !isFiniteNumber(value.longitude) ||
    !(typeof value.admin1 === 'string' || value.admin1 === null) ||
    typeof value.country !== 'string'
  ) {
    throw new Error('Unexpected location search response');
  }
  return value as LocationSearchResult;
}

function locationQuery(location: WeatherLocation): string {
  return new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    location: location.name,
  }).toString();
}

export async function fetchWeatherOverview(
  location: WeatherLocation,
  signal?: AbortSignal
): Promise<WeatherOverview> {
  const data = await requestJson(`/weather/overview?${locationQuery(location)}`, { signal });
  if (!isRecord(data) || !Array.isArray(data.hourly) || data.hourly.length === 0) {
    throw new Error('Unexpected weather overview response');
  }
  return {
    current: parseCurrentWeather(data.current),
    hourly: data.hourly.map(parseHourlyWeather),
    next_rain: data.next_rain === null ? null : parseRainEvent(data.next_rain),
  };
}

export async function searchLocations(
  query: string,
  signal?: AbortSignal
): Promise<LocationSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const data = await requestJson(`/locations/search?${params.toString()}`, { signal });
  if (!Array.isArray(data)) {
    throw new Error('Unexpected location search response');
  }
  return data.map(parseLocation);
}
