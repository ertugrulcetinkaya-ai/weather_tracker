import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WeatherLocation } from '../types/weather';

const LOCATION_STORAGE_KEY = 'weather_tracker:selected_location';
const FAVORITES_STORAGE_KEY = 'weather_tracker:favorite_locations';

export type LocationPreferences = {
  selectedLocation: WeatherLocation | null;
  favorites: WeatherLocation[];
};

export function isSameLocation(a: WeatherLocation, b: WeatherLocation): boolean {
  return a.name === b.name && a.latitude === b.latitude && a.longitude === b.longitude;
}

function parseLocation(value: unknown): WeatherLocation | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Partial<WeatherLocation>;
  if (
    typeof candidate.name !== 'string' ||
    candidate.name.trim() === '' ||
    typeof candidate.latitude !== 'number' ||
    typeof candidate.longitude !== 'number' ||
    !Number.isFinite(candidate.latitude) ||
    !Number.isFinite(candidate.longitude) ||
    candidate.latitude < -90 ||
    candidate.latitude > 90 ||
    candidate.longitude < -180 ||
    candidate.longitude > 180
  ) {
    return null;
  }
  return {
    name: candidate.name.trim(),
    latitude: candidate.latitude,
    longitude: candidate.longitude,
  };
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function parseFavorites(raw: string | null): WeatherLocation[] {
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) return [];

  const favorites: WeatherLocation[] = [];
  for (const item of parsed) {
    const location = parseLocation(item);
    if (location !== null && !favorites.some((favorite) => isSameLocation(favorite, location))) {
      favorites.push(location);
    }
  }
  return favorites;
}

export async function loadLocationPreferences(): Promise<LocationPreferences> {
  const [rawLocation, rawFavorites] = await Promise.all([
    AsyncStorage.getItem(LOCATION_STORAGE_KEY),
    AsyncStorage.getItem(FAVORITES_STORAGE_KEY),
  ]);
  return {
    selectedLocation: parseLocation(parseJson(rawLocation)),
    favorites: parseFavorites(rawFavorites),
  };
}

export async function saveSelectedLocation(location: WeatherLocation): Promise<void> {
  await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
}

export async function saveFavorites(favorites: WeatherLocation[]): Promise<void> {
  await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
}
