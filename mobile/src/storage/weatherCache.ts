import AsyncStorage from '@react-native-async-storage/async-storage';

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

function isValidOverviewContainer(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if (!isPlainObject(value.current)) return false;
  if (!Array.isArray(value.hourly) || value.hourly.length !== 24) return false;
  if (!Array.isArray(value.daily) || value.daily.length !== 7) return false;
  if (value.next_rain !== null && !isPlainObject(value.next_rain)) return false;
  return true;
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

  const record = parsed as Record<string, unknown>;
  if (record.version !== 1) return null;

  const cachedLocation = record.location;
  if (
    !isPlainObject(cachedLocation) ||
    cachedLocation.name !== location.name ||
    cachedLocation.latitude !== location.latitude ||
    cachedLocation.longitude !== location.longitude
  ) {
    return null;
  }

  const fetchedAt = record.fetchedAt;
  if (typeof fetchedAt !== 'number' || !Number.isFinite(fetchedAt) || fetchedAt < 0) {
    return null;
  }

  if (!isValidOverviewContainer(record.overview)) return null;

  return parsed as unknown as WeatherCacheRecord;
}
