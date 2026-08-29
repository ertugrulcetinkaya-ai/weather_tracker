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

function overview(location: WeatherLocation): WeatherOverview {
  return {
    current: {
      location: location.name,
      temperature: 24,
      apparent_temperature: 24,
      humidity: 50,
      wind_speed: 8,
      weather_code: 1,
      time: '2026-08-30T12:00',
    },
    hourly: [
      {
        time: '2026-08-30T12:00',
        temperature: 24,
        precipitation: 0,
        weather_code: 1,
        wind_speed: 8,
      },
    ],
    next_rain: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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

  test('aborts stale location requests and keeps the newest snapshot', async () => {
    const first = deferred<WeatherOverview>();
    const second = deferred<WeatherOverview>();
    let firstSignal: AbortSignal | undefined;
    mockedFetchWeatherOverview
      .mockImplementationOnce((_location, signal) => {
        firstSignal = signal;
        return first.promise;
      })
      .mockImplementationOnce(() => second.promise);
    const { result, rerender } = await renderHook<
      ReturnType<typeof useWeatherOverview>,
      { location: WeatherLocation }
    >(
      ({ location }) => useWeatherOverview(location, true),
      { initialProps: { location: ELAZIG } }
    );

    await rerender({ location: ANKARA });
    expect(firstSignal?.aborted).toBe(true);

    await act(async () => {
      second.resolve(overview(ANKARA));
      await second.promise;
    });
    expect(result.current.overview?.current.location).toBe('Ankara');

    await act(async () => {
      first.resolve(overview(ELAZIG));
      await first.promise;
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
