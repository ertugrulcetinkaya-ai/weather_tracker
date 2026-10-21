import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseCachedWeatherOverview } from '../validation/weather';
import type { WeatherLocation, WeatherOverview } from '../types/weather';

const WEATHER_CACHE_STORAGE_PREFIX = 'weather_tracker:weather_cache:v2';

export type WeatherCacheRecord = {
  version: 1 | 2;
  location: WeatherLocation;
  fetchedAt: number;
  overview: WeatherOverview;
};

function buildWeatherCacheKey(location: WeatherLocation, version = 2): string {
  const prefix =
    version === 1 ? 'weather_tracker:weather_cache:v1' : WEATHER_CACHE_STORAGE_PREFIX;
  return `${prefix}:${encodeURIComponent(location.name)}:${location.latitude}:${location.longitude}`;
}

export async function saveWeatherCache(
  location: WeatherLocation,
  overview: WeatherOverview,
  fetchedAt: number = Date.now(),
): Promise<void> {
  const record: WeatherCacheRecord = { version: 2, location, fetchedAt, overview };
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
  const currentRaw = await AsyncStorage.getItem(buildWeatherCacheKey(location));
  const version = currentRaw === null ? 1 : 2;
  const raw = currentRaw ?? await AsyncStorage.getItem(buildWeatherCacheKey(location, 1));
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isPlainObject(parsed)) return null;

  if (parsed.version !== version) return null;

  const cachedLocation = parsed.location;
  if (!isMatchingLocation(cachedLocation, location)) return null;

  const fetchedAt = parsed.fetchedAt;
  if (typeof fetchedAt !== 'number' || !Number.isFinite(fetchedAt) || fetchedAt < 0) {
    return null;
  }

  let overview: WeatherOverview;
  try {
    overview = parseCachedWeatherOverview(parsed.overview);
  } catch {
    return null;
  }

  return {
    version,
    location: { name: location.name, latitude: location.latitude, longitude: location.longitude },
    fetchedAt,
    overview,
  };
}
