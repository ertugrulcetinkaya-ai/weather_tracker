import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isSameLocation,
  loadLocationPreferences,
  saveFavorites,
  saveSelectedLocation,
} from '../locations';

const SELECTED_KEY = 'weather_tracker:selected_location';
const FAVORITES_KEY = 'weather_tracker:favorite_locations';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('location storage', () => {
  test('loads, normalizes, deduplicates, and filters persisted locations', async () => {
    await AsyncStorage.setItem(
      SELECTED_KEY,
      JSON.stringify({ name: '  Ankara  ', latitude: 39.9334, longitude: 32.8597 })
    );
    await AsyncStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify([
        { name: ' İstanbul ', latitude: 41.0082, longitude: 28.9784 },
        { name: 'İstanbul', latitude: 41.0082, longitude: 28.9784 },
        { name: '', latitude: 38.0, longitude: 39.0 },
        { name: 'Invalid latitude', latitude: 91, longitude: 30 },
        { name: 'Invalid type', latitude: '41', longitude: 29 },
        null,
      ])
    );

    await expect(loadLocationPreferences()).resolves.toEqual({
      selectedLocation: { name: 'Ankara', latitude: 39.9334, longitude: 32.8597 },
      favorites: [{ name: 'İstanbul', latitude: 41.0082, longitude: 28.9784 }],
    });
  });

  test('falls back safely when persisted JSON is corrupt', async () => {
    await AsyncStorage.setItem(SELECTED_KEY, '{not-json');
    await AsyncStorage.setItem(FAVORITES_KEY, '{also-not-json');

    await expect(loadLocationPreferences()).resolves.toEqual({
      selectedLocation: null,
      favorites: [],
    });
  });

  test('persists selected and favorite locations under stable keys', async () => {
    const selected = { name: 'Elazığ', latitude: 38.6743, longitude: 39.2232 };
    const favorites = [selected, { name: 'Ankara', latitude: 39.9334, longitude: 32.8597 }];

    await saveSelectedLocation(selected);
    await saveFavorites(favorites);

    await expect(AsyncStorage.getItem(SELECTED_KEY)).resolves.toBe(JSON.stringify(selected));
    await expect(AsyncStorage.getItem(FAVORITES_KEY)).resolves.toBe(JSON.stringify(favorites));
  });

  test('compares the complete location identity', () => {
    const location = { name: 'Ankara', latitude: 39.9334, longitude: 32.8597 };

    expect(isSameLocation(location, { ...location })).toBe(true);
    expect(isSameLocation(location, { ...location, longitude: 33 })).toBe(false);
    expect(isSameLocation(location, { ...location, name: 'Başka Ankara' })).toBe(false);
  });
});
