import type {
  LocationSearchResult,
  WeatherLocation,
  WeatherOverview,
} from '../types/weather';

import { requestJson } from './client';
import { parseWeatherOverview } from '../validation/weather';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseLocation(value: unknown): LocationSearchResult {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    value.name.trim() === '' ||
    !isFiniteNumber(value.latitude) ||
    value.latitude < -90 ||
    value.latitude > 90 ||
    !isFiniteNumber(value.longitude) ||
    value.longitude < -180 ||
    value.longitude > 180 ||
    !(typeof value.admin1 === 'string' || value.admin1 === null) ||
    typeof value.country !== 'string' ||
    value.country.trim() === ''
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
  return parseWeatherOverview(data);
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
