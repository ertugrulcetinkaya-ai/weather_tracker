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
