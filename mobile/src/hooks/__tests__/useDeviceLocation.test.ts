import * as Location from 'expo-location';
import { act, renderHook } from '@testing-library/react-native';

import type {
  LocationGeocodedAddress,
  LocationObject,
  LocationPermissionResponse,
} from 'expo-location';
import type { WeatherLocation } from '../../types/weather';
import { useDeviceLocation } from '../useDeviceLocation';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getCurrentPositionAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

const mockedHasServicesEnabled = jest.mocked(Location.hasServicesEnabledAsync);
const mockedRequestPermission = jest.mocked(Location.requestForegroundPermissionsAsync);
const mockedGetCurrentPosition = jest.mocked(Location.getCurrentPositionAsync);
const mockedReverseGeocode = jest.mocked(Location.reverseGeocodeAsync);

const DEVICE: WeatherLocation = { name: 'Ankara', latitude: 39.9, longitude: 32.85 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function permission(granted: boolean): LocationPermissionResponse {
  return {
    granted,
    canAskAgain: !granted,
    expires: 'never',
    status: 'granted',
  } as LocationPermissionResponse;
}

function position(latitude: number, longitude: number): LocationObject {
  return {
    coords: {
      latitude,
      longitude,
      altitude: null,
      accuracy: 10,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: 1700000000000,
  };
}

function address(overrides: Partial<LocationGeocodedAddress> = {}): LocationGeocodedAddress {
  return {
    city: null,
    district: null,
    street: null,
    streetNumber: null,
    region: null,
    subregion: null,
    country: null,
    postalCode: null,
    name: null,
    isoCountryCode: null,
    timezone: null,
    formattedAddress: null,
    ...overrides,
  };
}

async function settle() {
  await act(async () => {
    for (let index = 0; index < 12; index += 1) {
      await Promise.resolve();
    }
  });
}

async function renderDeviceLocation() {
  const onLocation = jest.fn();
  const utils = await renderHook(() => useDeviceLocation());
  return { ...utils, onLocation };
}

async function requestAndSettle(
  result: { current: ReturnType<typeof useDeviceLocation> },
  onLocation: jest.Mock
) {
  await act(async () => {
    result.current.requestCurrentLocation(onLocation);
  });
  await settle();
}

beforeEach(() => {
  mockedHasServicesEnabled.mockResolvedValue(true);
  mockedRequestPermission.mockResolvedValue(permission(true));
  mockedGetCurrentPosition.mockResolvedValue(position(DEVICE.latitude, DEVICE.longitude));
  mockedReverseGeocode.mockResolvedValue([address({ city: 'Ankara' })]);
});

describe('useDeviceLocation startup', () => {
  test('touches no native location API until the user explicitly asks', async () => {
    const { result } = await renderDeviceLocation();

    expect(result.current.status).toBe('idle');
    expect(mockedHasServicesEnabled).not.toHaveBeenCalled();
    expect(mockedRequestPermission).not.toHaveBeenCalled();
    expect(mockedGetCurrentPosition).not.toHaveBeenCalled();
    expect(mockedReverseGeocode).not.toHaveBeenCalled();
  });
});

describe('useDeviceLocation success', () => {
  test('reports the exact device coordinates with balanced accuracy', async () => {
    const { onLocation, result } = await renderDeviceLocation();

    await requestAndSettle(result, onLocation);

    expect(mockedGetCurrentPosition).toHaveBeenCalledWith({ accuracy: 3 });
    expect(mockedReverseGeocode).toHaveBeenCalledWith({
      latitude: DEVICE.latitude,
      longitude: DEVICE.longitude,
    });
    expect(onLocation).toHaveBeenCalledTimes(1);
    expect(onLocation).toHaveBeenCalledWith(DEVICE);
    expect(result.current.status).toBe('idle');
  });

  test('uses the first address name', async () => {
    mockedReverseGeocode.mockResolvedValue([address({ city: 'İzmir' }), address({ city: 'Ignored' })]);
    const { onLocation, result } = await renderDeviceLocation();

    await requestAndSettle(result, onLocation);

    expect(onLocation).toHaveBeenCalledWith({
      name: 'İzmir',
      latitude: DEVICE.latitude,
      longitude: DEVICE.longitude,
    });
  });

  test('falls back to the generic name when reverse geocoding rejects', async () => {
    mockedReverseGeocode.mockRejectedValue(new Error('geocoder offline'));
    const { onLocation, result } = await renderDeviceLocation();

    await requestAndSettle(result, onLocation);

    expect(result.current.status).toBe('idle');
    expect(onLocation).toHaveBeenCalledWith({ ...DEVICE, name: 'Mevcut konum' });
  });

  test('falls back to the generic name when reverse geocoding is empty', async () => {
    mockedReverseGeocode.mockResolvedValue([]);
    const { onLocation, result } = await renderDeviceLocation();

    await requestAndSettle(result, onLocation);

    expect(onLocation).toHaveBeenCalledWith({ ...DEVICE, name: 'Mevcut konum' });
  });

  test('prefers city, then district, subregion and region, trimming each candidate', async () => {
    const cases: Array<[LocationGeocodedAddress, string]> = [
      [address({ city: '  Bursa  ', district: 'Nilüfer' }), 'Bursa'],
      [address({ city: '   ', district: ' Kadıköy ' }), 'Kadıköy'],
      [address({ city: null, district: '', subregion: ' Anadolu ' }), 'Anadolu'],
      [address({ city: null, district: null, subregion: null, region: 'Trakya' }), 'Trakya'],
    ];

    for (const [geocoded, expected] of cases) {
      mockedReverseGeocode.mockResolvedValue([geocoded]);
      const { onLocation, result } = await renderDeviceLocation();

      await requestAndSettle(result, onLocation);

      expect(onLocation).toHaveBeenLastCalledWith({
        name: expected,
        latitude: DEVICE.latitude,
        longitude: DEVICE.longitude,
      });
    }
  });

  test('never uses the street as a place name', async () => {
    mockedReverseGeocode.mockResolvedValue([address({ street: 'Atatürk Bulvarı' })]);
    const { onLocation, result } = await renderDeviceLocation();

    await requestAndSettle(result, onLocation);

    expect(onLocation).toHaveBeenCalledWith({ ...DEVICE, name: 'Mevcut konum' });
  });
});

describe('useDeviceLocation privacy guards', () => {
  test('stops before GPS when foreground permission is not granted', async () => {
    mockedRequestPermission.mockResolvedValue(permission(false));
    const { onLocation, result } = await renderDeviceLocation();

    await requestAndSettle(result, onLocation);

    expect(result.current.status).toBe('permission-denied');
    expect(mockedGetCurrentPosition).not.toHaveBeenCalled();
    expect(mockedReverseGeocode).not.toHaveBeenCalled();
    expect(onLocation).not.toHaveBeenCalled();
  });

  test('stops before asking for permission when location services are disabled', async () => {
    mockedHasServicesEnabled.mockResolvedValue(false);
    const { onLocation, result } = await renderDeviceLocation();

    await requestAndSettle(result, onLocation);

    expect(result.current.status).toBe('services-disabled');
    expect(mockedRequestPermission).not.toHaveBeenCalled();
    expect(mockedGetCurrentPosition).not.toHaveBeenCalled();
    expect(onLocation).not.toHaveBeenCalled();
  });
});

describe('useDeviceLocation failures', () => {
  test.each([
    ['services check', () => mockedHasServicesEnabled.mockRejectedValue(new Error('boom'))],
    ['permission check', () => mockedRequestPermission.mockRejectedValue(new Error('boom'))],
    ['acquisition', () => mockedGetCurrentPosition.mockRejectedValue(new Error('boom'))],
  ])('surfaces an error when the %s fails', async (_label, breakStep) => {
    breakStep();
    const { onLocation, result } = await renderDeviceLocation();

    await requestAndSettle(result, onLocation);

    expect(result.current.status).toBe('error');
    expect(mockedReverseGeocode).not.toHaveBeenCalled();
    expect(onLocation).not.toHaveBeenCalled();
  });

  test.each([
    ['NaN latitude', Number.NaN, 32.85],
    ['NaN longitude', 39.9, Number.NaN],
    ['infinite latitude', Number.POSITIVE_INFINITY, 32.85],
    ['infinite longitude', 39.9, Number.NEGATIVE_INFINITY],
    ['latitude out of range', 90.5, 32.85],
    ['longitude out of range', 39.9, -180.5],
  ])('rejects %s without reverse geocoding', async (_label, latitude, longitude) => {
    mockedGetCurrentPosition.mockResolvedValue(position(latitude, longitude));
    const { onLocation, result } = await renderDeviceLocation();

    await requestAndSettle(result, onLocation);

    expect(result.current.status).toBe('error');
    expect(mockedReverseGeocode).not.toHaveBeenCalled();
    expect(onLocation).not.toHaveBeenCalled();
  });

  test('allows a retry after a failure', async () => {
    mockedGetCurrentPosition.mockRejectedValueOnce(new Error('boom'));
    const { onLocation, result } = await renderDeviceLocation();

    await requestAndSettle(result, onLocation);
    expect(result.current.status).toBe('error');

    await requestAndSettle(result, onLocation);

    expect(result.current.status).toBe('idle');
    expect(onLocation).toHaveBeenCalledTimes(1);
    expect(mockedGetCurrentPosition).toHaveBeenCalledTimes(2);
  });
});

describe('useDeviceLocation concurrency', () => {
  test('ignores repeated requests while a request is in flight', async () => {
    const pending = deferred<LocationObject>();
    mockedGetCurrentPosition.mockReturnValue(pending.promise);
    const { onLocation, result } = await renderDeviceLocation();

    await act(async () => {
      result.current.requestCurrentLocation(onLocation);
      result.current.requestCurrentLocation(onLocation);
    });
    await settle();

    expect(mockedHasServicesEnabled).toHaveBeenCalledTimes(1);
    expect(mockedGetCurrentPosition).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('loading');

    await act(async () => {
      pending.resolve(position(DEVICE.latitude, DEVICE.longitude));
      await pending.promise;
    });
    await settle();

    expect(onLocation).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
  });

  test('drops the result of a request that was cancelled', async () => {
    const pending = deferred<LocationObject>();
    mockedGetCurrentPosition.mockReturnValue(pending.promise);
    const { onLocation, result } = await renderDeviceLocation();

    await act(async () => {
      result.current.requestCurrentLocation(onLocation);
    });
    await settle();
    await act(async () => {
      result.current.cancelPendingRequest();
    });
    expect(result.current.status).toBe('idle');

    await act(async () => {
      pending.resolve(position(DEVICE.latitude, DEVICE.longitude));
      await pending.promise;
    });
    await settle();

    expect(onLocation).not.toHaveBeenCalled();
    expect(mockedReverseGeocode).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  test('waits for a cancelled native request to settle before starting another one', async () => {
    const cancelled = deferred<LocationObject>();
    mockedGetCurrentPosition.mockReturnValueOnce(cancelled.promise);
    const { onLocation, result } = await renderDeviceLocation();

    await act(async () => {
      result.current.requestCurrentLocation(onLocation);
    });
    await settle();
    await act(async () => {
      result.current.cancelPendingRequest();
    });

    await act(async () => {
      result.current.requestCurrentLocation(onLocation);
    });
    await settle();

    expect(mockedGetCurrentPosition).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
    expect(onLocation).not.toHaveBeenCalled();

    await act(async () => {
      cancelled.resolve(position(DEVICE.latitude, DEVICE.longitude));
      await cancelled.promise;
    });
    await settle();

    await act(async () => {
      result.current.requestCurrentLocation(onLocation);
    });
    await settle();

    expect(mockedGetCurrentPosition).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('idle');
    expect(onLocation).toHaveBeenCalledTimes(1);
    expect(onLocation).toHaveBeenCalledWith(DEVICE);
  });

  test('drops results and state after unmount', async () => {
    const pending = deferred<LocationObject>();
    mockedGetCurrentPosition.mockReturnValue(pending.promise);
    const { onLocation, result, unmount } = await renderDeviceLocation();

    await act(async () => {
      result.current.requestCurrentLocation(onLocation);
    });
    await settle();
    await unmount();

    await act(async () => {
      pending.resolve(position(DEVICE.latitude, DEVICE.longitude));
      await pending.promise;
    });
    await settle();

    expect(onLocation).not.toHaveBeenCalled();
    expect(mockedReverseGeocode).not.toHaveBeenCalled();
    expect(result.current.status).toBe('loading');
  });
});

describe('useDeviceLocation cancellation points', () => {
  test('stops between the services check and the permission request', async () => {
    const pending = deferred<boolean>();
    mockedHasServicesEnabled.mockReturnValue(pending.promise);
    const { onLocation, result } = await renderDeviceLocation();

    await act(async () => {
      result.current.requestCurrentLocation(onLocation);
    });
    await settle();
    await act(async () => {
      result.current.cancelPendingRequest();
    });
    await act(async () => {
      pending.resolve(true);
      await pending.promise;
    });
    await settle();

    expect(mockedRequestPermission).not.toHaveBeenCalled();
    expect(mockedGetCurrentPosition).not.toHaveBeenCalled();
    expect(onLocation).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  test('stops between the permission request and the GPS fix', async () => {
    const pending = deferred<LocationPermissionResponse>();
    mockedRequestPermission.mockReturnValue(pending.promise);
    const { onLocation, result } = await renderDeviceLocation();

    await act(async () => {
      result.current.requestCurrentLocation(onLocation);
    });
    await settle();
    await act(async () => {
      result.current.cancelPendingRequest();
    });
    await act(async () => {
      pending.resolve(permission(true));
      await pending.promise;
    });
    await settle();

    expect(mockedGetCurrentPosition).not.toHaveBeenCalled();
    expect(onLocation).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  test('drops a fix that resolves after cancellation during reverse geocoding', async () => {
    const pending = deferred<LocationGeocodedAddress[]>();
    mockedReverseGeocode.mockReturnValue(pending.promise);
    const { onLocation, result } = await renderDeviceLocation();

    await act(async () => {
      result.current.requestCurrentLocation(onLocation);
    });
    await settle();
    await act(async () => {
      result.current.cancelPendingRequest();
    });
    await act(async () => {
      pending.resolve([address({ city: 'Ankara' })]);
      await pending.promise;
    });
    await settle();

    expect(onLocation).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  test('keeps the idle state when a cancelled request rejects', async () => {
    const pending = deferred<LocationObject>();
    mockedGetCurrentPosition.mockReturnValue(pending.promise);
    const { onLocation, result } = await renderDeviceLocation();

    await act(async () => {
      result.current.requestCurrentLocation(onLocation);
    });
    await settle();
    await act(async () => {
      result.current.cancelPendingRequest();
    });
    await act(async () => {
      pending.reject(new Error('cancelled natively'));
      await expect(pending.promise).rejects.toThrow('cancelled natively');
    });
    await settle();

    expect(result.current.status).toBe('idle');
    expect(onLocation).not.toHaveBeenCalled();
  });
});

describe('useDeviceLocation cancel', () => {
  test('resets an error back to idle', async () => {
    mockedGetCurrentPosition.mockRejectedValueOnce(new Error('boom'));
    const { onLocation, result } = await renderDeviceLocation();

    await requestAndSettle(result, onLocation);
    expect(result.current.status).toBe('error');

    await act(async () => {
      result.current.cancelPendingRequest();
    });

    expect(result.current.status).toBe('idle');
  });

  test('can be called while idle without starting anything', async () => {
    const { result } = await renderDeviceLocation();

    await act(async () => {
      result.current.cancelPendingRequest();
    });

    expect(result.current.status).toBe('idle');
    expect(mockedHasServicesEnabled).not.toHaveBeenCalled();
  });
});
