import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseWeatherOverview } from '../validation/weather';
import type { WeatherLocation, WeatherOverview } from '../types/weather';

const WEATHER_CACHE_STORAGE_PREFIX = 'weather_tracker:weather_cache:v1';

export type WeatherCacheRecord = {
  version: 1;
  location: WeatherLocation;
  fetchedAt: number;
  overview: WeatherOverview;
};

function buildWeatherCacheKey(location: WeatherLocation): string {
  return `${WEATHER_CACHE_STORAGE_PREFIX}:${encodeURIComponent(location.name)}:${location.latitude}:${location.longitude}`;
}

export async function saveWeatherCache(
  location: WeatherLocation,
  overview: WeatherOverview,
  fetchedAt: number = Date.now(),
): Promise<void> {
  const record: WeatherCacheRecord = { version: 1, location, fetchedAt, overview };
  await AsyncStorage.setItem(buildWeatherCacheKey(location), JSON.stringify(record));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMatchingLocation(value: unknown, location: WeatherLocation): value is WeatherLocation {
  return (
    isPlainObject(value) &&
    value.name === location.name &&
    value.latitude === location.latitude &&
    value.longitude === location.longitude
  );
}

export async function loadWeatherCache(
  location: WeatherLocation,
): Promise<WeatherCacheRecord | null> {
  const raw = await AsyncStorage.getItem(buildWeatherCacheKey(location));
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isPlainObject(parsed)) return null;

  if (parsed.version !== 1) return null;

  const cachedLocation = parsed.location;
  if (!isMatchingLocation(cachedLocation, location)) return null;

  const fetchedAt = parsed.fetchedAt;
  if (typeof fetchedAt !== 'number' || !Number.isFinite(fetchedAt) || fetchedAt < 0) {
    return null;
  }

  let overview: WeatherOverview;
  try {
    overview = parseWeatherOverview(parsed.overview);
  } catch {
    return null;
  }

  return {
    version: 1,
    location: { name: location.name, latitude: location.latitude, longitude: location.longitude },
    fetchedAt,
    overview,
  };
}
