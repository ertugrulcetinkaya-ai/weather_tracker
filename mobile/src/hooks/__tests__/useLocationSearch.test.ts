import { act, renderHook } from '@testing-library/react-native';

import { searchLocations } from '../../api/weather';
import type { LocationSearchResult } from '../../types/weather';
import { useLocationSearch } from '../useLocationSearch';

jest.mock('../../api/weather', () => ({
  searchLocations: jest.fn(),
}));

const mockedSearchLocations = jest.mocked(searchLocations);
const ANKARA: LocationSearchResult = {
  name: 'Ankara',
  latitude: 39.9334,
  longitude: 32.8597,
  admin1: 'Ankara',
  country: 'Türkiye',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

beforeEach(() => {
  mockedSearchLocations.mockReset();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useLocationSearch', () => {
  test('ignores short queries and debounces valid ones', async () => {
    mockedSearchLocations.mockResolvedValue([ANKARA]);
    const { result } = await renderHook(() => useLocationSearch());

    await act(() => result.current.setQuery('a'));
    expect(result.current.status).toBe('idle');
    expect(mockedSearchLocations).not.toHaveBeenCalled();

    await act(() => result.current.setQuery('ank'));
    expect(result.current.status).toBe('loading');
    await act(() => jest.advanceTimersByTime(349));
    expect(mockedSearchLocations).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(mockedSearchLocations).toHaveBeenCalledWith('ank', expect.any(AbortSignal));
    expect(result.current.status).toBe('ready');
    expect(result.current.results).toEqual([ANKARA]);
  });

  test('aborts a superseded request and only exposes the latest result', async () => {
    const first = deferred<LocationSearchResult[]>();
    const second = deferred<LocationSearchResult[]>();
    let firstSignal: AbortSignal | undefined;
    mockedSearchLocations
      .mockImplementationOnce((_query, signal) => {
        firstSignal = signal;
        return first.promise;
      })
      .mockImplementationOnce(() => second.promise);
    const { result } = await renderHook(() => useLocationSearch());

    await act(() => result.current.setQuery('ank'));
    await act(() => jest.advanceTimersByTime(350));
    expect(firstSignal?.aborted).toBe(false);

    await act(() => result.current.setQuery('izmir'));
    expect(firstSignal?.aborted).toBe(true);
    expect(result.current.results).toEqual([]);
    await act(() => jest.advanceTimersByTime(350));

    await act(async () => {
      second.resolve([{ ...ANKARA, name: 'İzmir' }]);
      await second.promise;
    });

    expect(result.current.results[0]?.name).toBe('İzmir');
    expect(result.current.status).toBe('ready');

    await act(async () => {
      first.resolve([ANKARA]);
      await first.promise;
    });
    expect(result.current.results[0]?.name).toBe('İzmir');
  });

  test('reports request errors and reset returns to idle', async () => {
    mockedSearchLocations.mockRejectedValue(new Error('network'));
    const { result } = await renderHook(() => useLocationSearch());

    await act(() => result.current.setQuery('ankara'));
    await act(async () => {
      jest.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(result.current.status).toBe('error');

    await act(() => result.current.reset());
    expect(result.current.query).toBe('');
    expect(result.current.status).toBe('idle');
    expect(result.current.results).toEqual([]);
  });
});
