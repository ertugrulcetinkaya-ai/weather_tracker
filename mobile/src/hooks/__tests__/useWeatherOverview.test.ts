import { act, renderHook, waitFor } from '@testing-library/react-native';

import { fetchWeatherOverview } from '../../api/weather';
import type { WeatherLocation, WeatherOverview } from '../../types/weather';
import { useWeatherOverview } from '../useWeatherOverview';

jest.mock('../../api/weather', () => ({
  fetchWeatherOverview: jest.fn(),
}));

const mockedFetchWeatherOverview = jest.mocked(fetchWeatherOverview);
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

beforeEach(() => {
  mockedFetchWeatherOverview.mockReset();
});

describe('useWeatherOverview', () => {
  test('does not fetch before location preferences are hydrated', async () => {
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, false));

    expect(result.current.status).toBe('idle');
    expect(mockedFetchWeatherOverview).not.toHaveBeenCalled();
  });

  test('loads an atomic overview snapshot', async () => {
    mockedFetchWeatherOverview.mockResolvedValue(overview(ELAZIG));
    const { result } = await renderHook(() => useWeatherOverview(ELAZIG, true));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.overview?.current.location).toBe('Elazığ');
    expect(mockedFetchWeatherOverview).toHaveBeenCalledWith(ELAZIG, expect.any(AbortSignal));
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
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(3));

    await act(async () => {
      staleRefresh.resolve(overview(ELAZIG, 99));
      await staleRefresh.promise;
    });
    expect(result.current.overview).toBeNull();

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
    await act(async () => result.current.refresh());

    expect(result.current.status).toBe('ready');
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
});
