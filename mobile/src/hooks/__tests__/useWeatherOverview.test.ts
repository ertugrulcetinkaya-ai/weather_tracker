import { act, renderHook, waitFor } from '@testing-library/react-native';

import { fetchWeatherOverview } from '../../api/weather';
import { loadWeatherCache, saveWeatherCache } from '../../storage/weatherCache';
import type { WeatherLocation, WeatherOverview } from '../../types/weather';
import { useWeatherOverview } from '../useWeatherOverview';

jest.mock('../../api/weather', () => ({
  fetchWeatherOverview: jest.fn(),
}));

jest.mock('../../storage/weatherCache', () => ({
  loadWeatherCache: jest.fn(),
  saveWeatherCache: jest.fn(),
}));

const mockedFetchWeatherOverview = jest.mocked(fetchWeatherOverview);
const mockedLoadWeatherCache = jest.mocked(loadWeatherCache);
const mockedSaveWeatherCache = jest.mocked(saveWeatherCache);
const ELAZIG: WeatherLocation = { name: 'Elazığ', latitude: 38.6743, longitude: 39.2232 };
const ANKARA: WeatherLocation = { name: 'Ankara', latitude: 39.9334, longitude: 32.8597 };

function overview(location: WeatherLocation, temperature = 24): WeatherOverview {
  return {
    current: {
      location: location.name,
      temperature,
      apparent_temperature: temperature,
      humidity: 50,
      wind_speed: 8,
      weather_code: 1,
      time: '2026-08-30T12:00',
    },
    hourly: [
      {
        time: '2026-08-30T12:00',
        temperature,
        precipitation: 0,
        precipitation_probability: 20,
        weather_code: 1,
        wind_speed: 8,
      },
    ],
    daily: [
      {
        date: '2026-08-30',
        temperature_max: temperature + 5,
        temperature_min: temperature - 6,
        precipitation: 0.4,
        precipitation_probability: 20,
        weather_code: 1,
      },
    ],
    next_rain: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function cacheRecord(location: WeatherLocation, temperature = 18) {
  return { version: 1 as const, location, fetchedAt: 1, overview: overview(location, temperature) };
}

const realNow = Date.now;
let nowValue = 1_000_000;

beforeEach(() => {
  mockedFetchWeatherOverview.mockReset();
  mockedSaveWeatherCache.mockReset();
  mockedLoadWeatherCache.mockReset();
  mockedSaveWeatherCache.mockResolvedValue(undefined);
  mockedLoadWeatherCache.mockResolvedValue(null);
  nowValue = 1_000_000;
  Date.now = jest.fn(() => {
    nowValue += 1000;
    return nowValue;
  });
});

afterEach(() => {
  Date.now = realNow;
});

describe('useWeatherOverview', () => {
  test('does not fetch before location preferences are hydrated', async () => {
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, false));

    expect(result.current.status).toBe('idle');
    expect(mockedFetchWeatherOverview).not.toHaveBeenCalled();
  });

  test('loads an atomic overview snapshot with matching fetchedAt and persisted timestamp', async () => {
    mockedFetchWeatherOverview.mockResolvedValue(overview(ELAZIG));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.overview?.current.location).toBe('Elazığ');
    expect(result.current.fetchedAt).toBe(1_001_000);
    expect(mockedFetchWeatherOverview).toHaveBeenCalledWith(ELAZIG, expect.any(AbortSignal));
    expect(mockedSaveWeatherCache).toHaveBeenCalledWith(
      ELAZIG,
      result.current.overview,
      result.current.fetchedAt
    );
  });

  test('preserves the snapshot while an explicit refresh is pending and replaces it on success', async () => {
    const refreshed = deferred<WeatherOverview>();
    mockedFetchWeatherOverview
      .mockResolvedValueOnce(overview(ELAZIG))
      .mockImplementationOnce(() => refreshed.promise);
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.overview?.current.temperature).toBe(24);

    await act(async () => {
      void result.current.refresh();
      await Promise.resolve();
    });
    await waitFor(() => expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(2));

    expect(result.current.overview?.current.location).toBe('Elazığ');
    expect(result.current.refreshStatus).toBe('loading');

    await act(async () => {
      refreshed.resolve(overview(ELAZIG, 31));
      await refreshed.promise;
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.overview?.current.temperature).toBe(31);
    expect(result.current.refreshStatus).toBe('idle');
    expect(mockedSaveWeatherCache).toHaveBeenLastCalledWith(
      ELAZIG,
      result.current.overview,
      result.current.fetchedAt
    );
  });

  test('preserves the snapshot when an explicit refresh fails', async () => {
    mockedFetchWeatherOverview
      .mockResolvedValueOnce(overview(ELAZIG))
      .mockRejectedValueOnce(new Error('refresh failed'));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.overview?.current.location).toBe('Elazığ');
    expect(result.current.refreshStatus).toBe('error');
    expect(mockedSaveWeatherCache).toHaveBeenCalledTimes(1);
    expect(mockedSaveWeatherCache).toHaveBeenCalledWith(
      ELAZIG,
      result.current.overview,
      result.current.fetchedAt
    );
  });

  test('aborts the stale refresh on location change and clears the old snapshot', async () => {
    const staleRefresh = deferred<WeatherOverview>();
    const ankara = deferred<WeatherOverview>();
    let staleSignal: AbortSignal | undefined;
    mockedFetchWeatherOverview
      .mockResolvedValueOnce(overview(ELAZIG))
      .mockImplementationOnce((_location, signal) => {
        staleSignal = signal;
        return staleRefresh.promise;
      })
      .mockImplementationOnce(() => ankara.promise);
    const { result, rerender } = await renderHook<
      ReturnType<typeof useWeatherOverview>,
      { location: WeatherLocation }
    >(
      ({ location }) => useWeatherOverview(location, true),
      { initialProps: { location: ELAZIG } }
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      void result.current.refresh();
      await Promise.resolve();
    });
    await waitFor(() => expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(2));
    expect(result.current.overview?.current.location).toBe('Elazığ');

    await rerender({ location: ANKARA });
    expect(staleSignal?.aborted).toBe(true);
    expect(result.current.overview).toBeNull();
    expect(result.current.fetchedAt).toBeNull();
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(3));

    await act(async () => {
      staleRefresh.resolve(overview(ELAZIG, 99));
      await staleRefresh.promise;
    });
    expect(result.current.overview).toBeNull();
    expect(mockedSaveWeatherCache).toHaveBeenCalledTimes(1);

    await act(async () => {
      ankara.resolve(overview(ANKARA));
      await ankara.promise;
    });
    expect(result.current.overview?.current.location).toBe('Ankara');
  });

  test('exposes failures and supports an explicit retry', async () => {
    mockedFetchWeatherOverview
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(overview(ELAZIG));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(mockedSaveWeatherCache).not.toHaveBeenCalled();
    await act(async () => result.current.refresh());

    expect(result.current.status).toBe('ready');
    expect(result.current.overview?.current.location).toBe('Elazığ');
  });

  test('keeps overview ready when cache persistence rejects', async () => {
    mockedFetchWeatherOverview.mockResolvedValue(overview(ELAZIG));
    mockedSaveWeatherCache.mockRejectedValueOnce(new Error('storage unavailable'));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(mockedSaveWeatherCache).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.refreshStatus).toBe('idle');
    expect(result.current.overview?.current.location).toBe('Elazığ');
  });

  test('aborts the active request when the hook unmounts', async () => {
    const pending = deferred<WeatherOverview>();
    let signal: AbortSignal | undefined;
    mockedFetchWeatherOverview.mockImplementation((_location, requestSignal) => {
      signal = requestSignal;
      return pending.promise;
    });
    const { unmount } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await unmount();

    expect(signal?.aborted).toBe(true);
  });

  test('hydrates from an active cache while the network request is pending', async () => {
    const network = deferred<WeatherOverview>();
    mockedLoadWeatherCache.mockResolvedValue(cacheRecord(ELAZIG, 18));
    mockedFetchWeatherOverview.mockImplementation(() => network.promise);
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.overview?.current.temperature).toBe(18);
    expect(result.current.fetchedAt).toBe(1);
    expect(result.current.refreshStatus).toBe('loading');

    await act(async () => {
      network.resolve(overview(ELAZIG, 24));
      await network.promise;
    });

    expect(result.current.overview?.current.temperature).toBe(24);
    expect(result.current.fetchedAt).toBe(1_001_000);
    expect(result.current.status).toBe('ready');
    expect(result.current.refreshStatus).toBe('idle');
    expect(mockedSaveWeatherCache).toHaveBeenCalledWith(
      ELAZIG,
      result.current.overview,
      1_001_000
    );
  });

  test('does not read cache when the hook is disabled', async () => {
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, false));

    expect(result.current.status).toBe('idle');
    expect(mockedLoadWeatherCache).not.toHaveBeenCalled();
    expect(mockedFetchWeatherOverview).not.toHaveBeenCalled();
  });

  test('does not read cache during an explicit refresh', async () => {
    mockedFetchWeatherOverview.mockResolvedValueOnce(overview(ELAZIG));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockedLoadWeatherCache).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(2);
    expect(mockedLoadWeatherCache).toHaveBeenCalledTimes(1);
  });

  test('swallows a cache read rejection and surfaces only the network outcome', async () => {
    mockedLoadWeatherCache.mockRejectedValueOnce(new Error('storage unavailable'));
    mockedFetchWeatherOverview.mockResolvedValueOnce(overview(ELAZIG));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.overview?.current.location).toBe('Elazığ');
    expect(result.current.refreshStatus).toBe('idle');
  });

  test('keeps network data authoritative when the cache resolves later', async () => {
    const cache = deferred<Awaited<ReturnType<typeof loadWeatherCache>>>();
    mockedLoadWeatherCache.mockReturnValue(cache.promise);
    mockedFetchWeatherOverview.mockResolvedValueOnce(overview(ELAZIG, 24));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.overview?.current.temperature).toBe(24);
    const freshFetchedAt = result.current.fetchedAt;

    await act(async () => {
      cache.resolve(cacheRecord(ELAZIG, 18));
      await cache.promise;
    });

    expect(result.current.overview?.current.temperature).toBe(24);
    expect(result.current.fetchedAt).toBe(freshFetchedAt);
    expect(result.current.refreshStatus).toBe('idle');
  });

  test('keeps a hydrated cache snapshot ready when the network request fails', async () => {
    mockedLoadWeatherCache.mockResolvedValueOnce(cacheRecord(ELAZIG, 18));
    mockedFetchWeatherOverview.mockRejectedValueOnce(new Error('network'));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.overview?.current.temperature).toBe(18);
    expect(result.current.fetchedAt).toBe(1);
    expect(result.current.status).toBe('ready');
    expect(result.current.refreshStatus).toBe('error');
  });

  test('hydrates from a still-active cache after the network request fails', async () => {
    const cache = deferred<Awaited<ReturnType<typeof loadWeatherCache>>>();
    mockedLoadWeatherCache.mockReturnValue(cache.promise);
    mockedFetchWeatherOverview.mockRejectedValueOnce(new Error('network'));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(mockedLoadWeatherCache).toHaveBeenCalledTimes(1);

    await act(async () => {
      cache.resolve(cacheRecord(ELAZIG, 18));
      await cache.promise;
    });

    expect(result.current.overview?.current.temperature).toBe(18);
    expect(result.current.status).toBe('ready');
    expect(result.current.refreshStatus).toBe('error');
  });

  test('shows loading with no overview during a cache miss while network is pending', async () => {
    const network = deferred<WeatherOverview>();
    mockedLoadWeatherCache.mockResolvedValueOnce(null);
    mockedFetchWeatherOverview.mockImplementation(() => network.promise);
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(mockedLoadWeatherCache).toHaveBeenCalledTimes(1));

    expect(result.current.overview).toBeNull();
    expect(result.current.fetchedAt).toBeNull();
    expect(result.current.status).toBe('loading');
    expect(result.current.refreshStatus).toBe('idle');

    await act(async () => {
      network.resolve(overview(ELAZIG, 24));
      await network.promise;
    });

    expect(result.current.overview?.current.location).toBe('Elazığ');
    expect(result.current.status).toBe('ready');
    expect(result.current.refreshStatus).toBe('idle');
  });

  test('discards a stale cache read after the location is superseded', async () => {
    const elazigCache = deferred<Awaited<ReturnType<typeof loadWeatherCache>>>();
    mockedLoadWeatherCache.mockImplementation((location) => {
      if (location.name === 'Elazığ') return elazigCache.promise;
      return Promise.resolve(null);
    });
    const ankara = deferred<WeatherOverview>();
    mockedFetchWeatherOverview
      .mockImplementationOnce(() => new Promise<never>(() => undefined))
      .mockImplementationOnce(() => ankara.promise);
    const { result, rerender } = await renderHook<
      ReturnType<typeof useWeatherOverview>,
      { location: WeatherLocation }
    >(
      ({ location }) => useWeatherOverview(location, true),
      { initialProps: { location: ELAZIG } }
    );

    await waitFor(() => expect(mockedLoadWeatherCache).toHaveBeenCalledTimes(1));

    await rerender({ location: ANKARA });

    await act(async () => {
      elazigCache.resolve(cacheRecord(ELAZIG, 18));
      await elazigCache.promise;
    });

    expect(result.current.overview).toBeNull();
    expect(result.current.fetchedAt).toBeNull();
    expect(mockedLoadWeatherCache).toHaveBeenCalledTimes(2);

    await act(async () => {
      ankara.resolve(overview(ANKARA));
      await ankara.promise;
    });

    expect(result.current.overview?.current.location).toBe('Ankara');
  });

  test('preserves fetchedAt while an explicit refresh is pending and replaces it on success', async () => {
    const refreshed = deferred<WeatherOverview>();
    mockedFetchWeatherOverview
      .mockResolvedValueOnce(overview(ELAZIG))
      .mockImplementationOnce(() => refreshed.promise);
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    const initialFetchedAt = result.current.fetchedAt;

    await act(async () => {
      void result.current.refresh();
      await Promise.resolve();
    });
    await waitFor(() => expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(2));

    expect(result.current.fetchedAt).toBe(initialFetchedAt);
    expect(result.current.refreshStatus).toBe('loading');

    await act(async () => {
      refreshed.resolve(overview(ELAZIG, 31));
      await refreshed.promise;
    });

    expect(result.current.fetchedAt).not.toBe(initialFetchedAt);
    expect(result.current.fetchedAt).toBe(1_002_000);
    expect(mockedSaveWeatherCache).toHaveBeenLastCalledWith(
      ELAZIG,
      result.current.overview,
      1_002_000
    );
  });

  test('preserves fetchedAt when an explicit refresh fails', async () => {
    mockedFetchWeatherOverview
      .mockResolvedValueOnce(overview(ELAZIG))
      .mockRejectedValueOnce(new Error('refresh failed'));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    const initialFetchedAt = result.current.fetchedAt;

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.fetchedAt).toBe(initialFetchedAt);
    expect(result.current.status).toBe('ready');
    expect(result.current.refreshStatus).toBe('error');
  });

  test('keeps fresh fetchedAt when cache persistence rejects', async () => {
    mockedFetchWeatherOverview.mockResolvedValue(overview(ELAZIG));
    mockedSaveWeatherCache.mockRejectedValueOnce(new Error('storage unavailable'));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(mockedSaveWeatherCache).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.fetchedAt).toBe(1_001_000);
    expect(result.current.status).toBe('ready');
    expect(result.current.refreshStatus).toBe('idle');
  });

  test('leaves fetchedAt null on an initial no-cache network failure', async () => {
    mockedLoadWeatherCache.mockResolvedValueOnce(null);
    mockedFetchWeatherOverview.mockRejectedValueOnce(new Error('network'));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.overview).toBeNull();
    expect(result.current.fetchedAt).toBeNull();
  });

  test('keeps an explicit retry network-only after an initial failed load', async () => {
    mockedLoadWeatherCache.mockResolvedValueOnce(null);
    mockedFetchWeatherOverview
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(overview(ELAZIG));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(mockedLoadWeatherCache).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(2);
    expect(mockedLoadWeatherCache).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ready');
    expect(result.current.overview?.current.location).toBe('Elazığ');
  });
});
