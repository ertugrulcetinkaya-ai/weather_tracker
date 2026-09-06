import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadWeatherCache, saveWeatherCache } from '../weatherCache';
import type { WeatherLocation, WeatherOverview } from '../../types/weather';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    __clearStore: () => {
      store = {};
    },
  };
});

const mockAsyncStorage = AsyncStorage as unknown as {
  setItem: jest.Mock;
  getItem: jest.Mock;
  __clearStore: () => void;
};

describe('saveWeatherCache', () => {
  beforeEach(() => {
    mockAsyncStorage.__clearStore();
    jest.clearAllMocks();
  });

  const location: WeatherLocation = {
    name: 'Ankara',
    latitude: 39.9208,
    longitude: 32.8541,
  };

  const overview: WeatherOverview = {
    current: {
      location: 'Ankara',
      temperature: 22.5,
      apparent_temperature: 21.0,
      humidity: 45,
      wind_speed: 3.2,
      weather_code: 2,
      time: '2023-11-14T12:00',
    },
    hourly: [
      {
        time: '2023-11-14T12:00',
        temperature: 22.5,
        precipitation: 0,
        precipitation_probability: 10,
        weather_code: 2,
        wind_speed: 3.2,
      },
    ],
    daily: [
      {
        date: '2023-11-14',
        temperature_max: 25.0,
        temperature_min: 15.0,
        precipitation: 0,
        precipitation_probability: 10,
        weather_code: 2,
      },
    ],
    next_rain: null,
  };

  it('persists exact JSON record with deterministic fetchedAt, version 1, location, and overview', async () => {
    const fetchedAt = 1700000000000;
    await saveWeatherCache(location, overview, fetchedAt);

    expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(1);
    const [key, value] = mockAsyncStorage.setItem.mock.calls[0];

    const parsed = JSON.parse(value);
    expect(parsed).toEqual({
      version: 1,
      fetchedAt,
      location,
      overview,
    });
    expect(typeof key).toBe('string');
  });

  it('writes to the identical storage key for two saves of the same exact location', async () => {
    const fetchedAt1 = 1700000000000;
    const fetchedAt2 = 1700000060000;

    await saveWeatherCache(location, overview, fetchedAt1);
    await saveWeatherCache(location, overview, fetchedAt2);

    expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(2);
    const [key1] = mockAsyncStorage.setItem.mock.calls[0];
    const [key2] = mockAsyncStorage.setItem.mock.calls[1];

    expect(key1).toBe(key2);
  });

  it('writes to different keys for locations with different names or coordinates', async () => {
    const locationNameDiff: WeatherLocation = { ...location, name: 'Izmir' };
    const locationCoordDiff: WeatherLocation = { ...location, latitude: 38.4237 };

    await saveWeatherCache(location, overview, 1700000000000);
    await saveWeatherCache(locationNameDiff, overview, 1700000000000);
    await saveWeatherCache(locationCoordDiff, overview, 1700000000000);

    const keys = mockAsyncStorage.setItem.mock.calls.map(([k]) => k);
    expect(new Set(keys).size).toBe(3);
  });

  it('safely and deterministically encodes a location name with spaces and Turkish characters in the key', async () => {
    const trickyLocation: WeatherLocation = {
      name: 'Kahramanmaraş Merkez',
      latitude: 37.585,
      longitude: 36.937,
    };

    await saveWeatherCache(trickyLocation, overview, 1700000000000);
    const [key] = mockAsyncStorage.setItem.mock.calls[0];

    // Key must not contain raw spaces or unencoded Turkish chars that could break storage
    expect(key).not.toContain(' ');
    expect(key).not.toContain('ş');
    expect(key).not.toContain('ğ');
    expect(key).not.toContain('ü');
    expect(key).not.toContain('ö');
    expect(key).not.toContain('ç');
    expect(key).not.toContain('İ');

    // Deterministic: same input produces same key
    await saveWeatherCache(trickyLocation, overview, 1700000060000);
    const [key2] = mockAsyncStorage.setItem.mock.calls[1];
    expect(key).toBe(key2);
  });
});

describe('loadWeatherCache', () => {
  beforeEach(() => {
    mockAsyncStorage.__clearStore();
    jest.clearAllMocks();
  });

  const location: WeatherLocation = {
    name: 'Ankara',
    latitude: 39.9208,
    longitude: 32.8541,
  };

  function buildOverview(): WeatherOverview {
    return {
      current: {
        location: 'Ankara',
        temperature: 22.5,
        apparent_temperature: 21.0,
        humidity: 45,
        wind_speed: 3.2,
        weather_code: 2,
        time: '2023-11-14T12:00',
      },
      hourly: Array.from({ length: 24 }, (_, i) => ({
        time: `2023-11-14T${String(i).padStart(2, '0')}:00`,
        temperature: 22.5,
        precipitation: 0,
        precipitation_probability: 10,
        weather_code: 2,
        wind_speed: 3.2,
      })),
      daily: Array.from({ length: 7 }, (_, i) => ({
        date: `2023-11-${14 + i}`,
        temperature_max: 25.0,
        temperature_min: 15.0,
        precipitation: 0,
        precipitation_probability: 10,
        weather_code: 2,
      })),
      next_rain: null,
    };
  }

  function seedRecord(overrides?: Partial<Record<string, unknown>>): void {
    const record = {
      version: 1,
      location,
      fetchedAt: 1700000000000,
      overview: buildOverview(),
      ...overrides,
    };
    // Write directly through the mocked store using saveWeatherCache's key derivation
    // by invoking setItem with a matching key. We reconstruct the key here to seed
    // arbitrary payloads without going through saveWeatherCache.
    const prefix = 'weather_tracker:weather_cache:v1';
    const key = `${prefix}:${encodeURIComponent(location.name)}:${location.latitude}:${location.longitude}`;
    mockAsyncStorage.setItem(key, JSON.stringify(record));
  }

  it('returns the exact parsed record for valid data', async () => {
    const fetchedAt = 1700000000000;
    await saveWeatherCache(location, buildOverview(), fetchedAt);

    const loaded = await loadWeatherCache(location);
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.fetchedAt).toBe(fetchedAt);
    expect(loaded!.location).toEqual(location);
    expect(loaded!.overview).toEqual(buildOverview());
  });

  it('returns null when no cache entry exists', async () => {
    const loaded = await loadWeatherCache(location);
    expect(loaded).toBeNull();
  });

  it('returns null for malformed JSON', async () => {
    const prefix = 'weather_tracker:weather_cache:v1';
    const key = `${prefix}:${encodeURIComponent(location.name)}:${location.latitude}:${location.longitude}`;
    mockAsyncStorage.setItem(key, '{not valid json');

    const loaded = await loadWeatherCache(location);
    expect(loaded).toBeNull();
  });

  it('returns null when version is not exactly 1', async () => {
    seedRecord({ version: 2 });
    const loaded = await loadWeatherCache(location);
    expect(loaded).toBeNull();
  });

  it('returns null on exact location mismatch by name, latitude, or longitude', async () => {
    seedRecord({ location: { ...location, name: 'Izmir' } });
    expect(await loadWeatherCache(location)).toBeNull();

    mockAsyncStorage.__clearStore();
    seedRecord({ location: { ...location, latitude: 38.4237 } });
    expect(await loadWeatherCache(location)).toBeNull();

    mockAsyncStorage.__clearStore();
    seedRecord({ location: { ...location, longitude: 27.1287 } });
    expect(await loadWeatherCache(location)).toBeNull();
  });

  it('returns null for invalid fetchedAt values', async () => {
    seedRecord({ fetchedAt: -1 });
    expect(await loadWeatherCache(location)).toBeNull();

    mockAsyncStorage.__clearStore();
    seedRecord({ fetchedAt: Number.NaN });
    expect(await loadWeatherCache(location)).toBeNull();

    mockAsyncStorage.__clearStore();
    seedRecord({ fetchedAt: '1700000000000' });
    expect(await loadWeatherCache(location)).toBeNull();

    mockAsyncStorage.__clearStore();
    seedRecord({ fetchedAt: Infinity });
    expect(await loadWeatherCache(location)).toBeNull();
  });

  it('returns null for invalid overview containers or counts', async () => {
    // current must be an object
    seedRecord({ overview: { ...buildOverview(), current: null } });
    expect(await loadWeatherCache(location)).toBeNull();

    mockAsyncStorage.__clearStore();
    // hourly must have exactly 24 entries
    const badHourly = buildOverview();
    badHourly.hourly = badHourly.hourly.slice(0, 23);
    seedRecord({ overview: badHourly });
    expect(await loadWeatherCache(location)).toBeNull();

    mockAsyncStorage.__clearStore();
    // daily must have exactly 7 entries
    const badDaily = buildOverview();
    badDaily.daily = badDaily.daily.slice(0, 6);
    seedRecord({ overview: badDaily });
    expect(await loadWeatherCache(location)).toBeNull();

    mockAsyncStorage.__clearStore();
    // next_rain must be null or an object
    seedRecord({ overview: { ...buildOverview(), next_rain: 'soon' } });
    expect(await loadWeatherCache(location)).toBeNull();

    mockAsyncStorage.__clearStore();
    // hourly must be an array
    seedRecord({ overview: { ...buildOverview(), hourly: {} } });
    expect(await loadWeatherCache(location)).toBeNull();
  });

  it('allows AsyncStorage.getItem rejection to propagate', async () => {
    const failure = new Error('storage unavailable');
    mockAsyncStorage.getItem.mockRejectedValueOnce(failure);

    await expect(loadWeatherCache(location)).rejects.toThrow(failure);
  });
});
