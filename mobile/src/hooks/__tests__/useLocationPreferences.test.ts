import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  loadLocationPreferences,
  saveFavorites,
  saveSelectedLocation,
} from '../../storage/locations';
import type { LocationPreferences } from '../../storage/locations';
import type { WeatherLocation } from '../../types/weather';
import { useLocationPreferences } from '../useLocationPreferences';

jest.mock('../../storage/locations', () => {
  const actual = jest.requireActual<typeof import('../../storage/locations')>(
    '../../storage/locations'
  );
  return {
    ...actual,
    loadLocationPreferences: jest.fn(),
    saveFavorites: jest.fn(),
    saveSelectedLocation: jest.fn(),
  };
});

const mockedLoadPreferences = jest.mocked(loadLocationPreferences);
const mockedSaveFavorites = jest.mocked(saveFavorites);
const mockedSaveSelectedLocation = jest.mocked(saveSelectedLocation);

const ELAZIG: WeatherLocation = { name: 'Elazığ', latitude: 38.6743, longitude: 39.2232 };
const ANKARA: WeatherLocation = { name: 'Ankara', latitude: 39.9334, longitude: 32.8597 };
const ISTANBUL: WeatherLocation = { name: 'İstanbul', latitude: 41.0082, longitude: 28.9784 };

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
  mockedLoadPreferences.mockReset();
  mockedSaveFavorites.mockReset().mockResolvedValue();
  mockedSaveSelectedLocation.mockReset().mockResolvedValue();
});

describe('useLocationPreferences', () => {
  test('hydrates the selected location and favorites', async () => {
    mockedLoadPreferences.mockResolvedValue({
      selectedLocation: ANKARA,
      favorites: [ISTANBUL],
    });

    const { result } = await renderHook(() => useLocationPreferences(ELAZIG));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.selectedLocation).toEqual(ANKARA);
    expect(result.current.favorites).toEqual([ISTANBUL]);
    expect(result.current.persistenceError).toBe(false);
  });

  test('replays and persists favorite changes made while hydration is pending', async () => {
    const pending = deferred<LocationPreferences>();
    mockedLoadPreferences.mockReturnValue(pending.promise);
    const { result } = await renderHook(() => useLocationPreferences(ELAZIG));

    await act(() => {
      result.current.selectLocation(ISTANBUL);
      result.current.toggleFavorite(ISTANBUL);
    });
    expect(result.current.selectedLocation).toEqual(ISTANBUL);
    expect(result.current.favorites).toEqual([ISTANBUL]);
    expect(mockedSaveFavorites).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve({ selectedLocation: ANKARA, favorites: [ANKARA] });
      await pending.promise;
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.selectedLocation).toEqual(ISTANBUL);
    expect(result.current.favorites).toEqual([ANKARA, ISTANBUL]);
    expect(mockedSaveFavorites).toHaveBeenCalledTimes(1);
    expect(mockedSaveFavorites).toHaveBeenCalledWith([ANKARA, ISTANBUL]);
  });

  test('replays multiple pending toggles in order over persisted favorites', async () => {
    const pending = deferred<LocationPreferences>();
    mockedLoadPreferences.mockReturnValue(pending.promise);
    const { result } = await renderHook(() => useLocationPreferences(ELAZIG));

    await act(() => {
      result.current.toggleFavorite(ANKARA);
      result.current.toggleFavorite(ANKARA);
    });
    expect(result.current.favorites).toEqual([]);
    expect(mockedSaveFavorites).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve({ selectedLocation: null, favorites: [ANKARA] });
      await pending.promise;
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.favorites).toEqual([ANKARA]);
    expect(mockedSaveFavorites).toHaveBeenCalledTimes(1);
    expect(mockedSaveFavorites).toHaveBeenCalledWith([ANKARA]);
  });

  test('persists favorite additions and removals', async () => {
    mockedLoadPreferences.mockResolvedValue({ selectedLocation: null, favorites: [] });
    const { result } = await renderHook(() => useLocationPreferences(ELAZIG));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    await act(() => result.current.toggleFavorite(ANKARA));
    expect(result.current.favorites).toEqual([ANKARA]);
    expect(mockedSaveFavorites).toHaveBeenLastCalledWith([ANKARA]);

    await act(() => result.current.toggleFavorite(ANKARA));
    expect(result.current.favorites).toEqual([]);
    expect(mockedSaveFavorites).toHaveBeenLastCalledWith([]);
  });

  test('surfaces storage failures without blocking hydration', async () => {
    mockedLoadPreferences.mockRejectedValue(new Error('storage unavailable'));
    const { result } = await renderHook(() => useLocationPreferences(ELAZIG));

    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.selectedLocation).toEqual(ELAZIG);
    expect(result.current.persistenceError).toBe(true);
  });

  test('does not persist favorite changes when hydration fails', async () => {
    const pending = deferred<LocationPreferences>();
    mockedLoadPreferences.mockReturnValue(pending.promise);
    const { result } = await renderHook(() => useLocationPreferences(ELAZIG));

    await act(() => result.current.toggleFavorite(ISTANBUL));
    expect(result.current.favorites).toEqual([ISTANBUL]);
    expect(mockedSaveFavorites).not.toHaveBeenCalled();

    await act(async () => {
      pending.reject(new Error('storage unavailable'));
      await pending.promise.catch(() => undefined);
    });
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.persistenceError).toBe(true);
    await act(() => result.current.toggleFavorite(ANKARA));

    expect(result.current.favorites).toEqual([ISTANBUL, ANKARA]);
    expect(result.current.persistenceError).toBe(true);
    expect(mockedSaveFavorites).not.toHaveBeenCalled();
  });
});
