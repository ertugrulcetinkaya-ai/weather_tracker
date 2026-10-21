import * as Location from 'expo-location';
import { AppState, RefreshControl } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { fetchWeatherOverview } from '../api/weather';
import { loadWeatherCache } from '../storage/weatherCache';
import type { WeatherCacheRecord } from '../storage/weatherCache';
import type { LocationGeocodedAddress, LocationPermissionResponse } from 'expo-location';
import type { WeatherOverview } from '../types/weather';
import App from '../../App';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getCurrentPositionAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));



jest.mock('../api/weather', () => ({
  fetchWeatherOverview: jest.fn(),
  searchLocations: jest.fn(),
}));

jest.mock('../storage/weatherCache', () => ({
  loadWeatherCache: jest.fn(async () => null),
  saveWeatherCache: jest.fn(async () => undefined),
}));

type AppStateStatus = 'active' | 'background' | 'inactive';
type AppStateListener = (nextAppState: AppStateStatus) => void;
type AppStateSubscription = { remove: jest.Mock };

const mockAppStateListeners: AppStateListener[] = [];

jest.spyOn(AppState, 'addEventListener').mockImplementation(
  (_type, listener) => {
    const subscription = { remove: jest.fn() } as unknown as AppStateSubscription;
    mockAppStateListeners.push(listener);
    subscription.remove.mockImplementation(() => {
      const index = mockAppStateListeners.indexOf(listener);
      if (index >= 0) {
        mockAppStateListeners.splice(index, 1);
      }
    });
    return subscription;
  }
);
const mockAddEventListener = AppState.addEventListener as unknown as jest.Mock<
  AppStateSubscription,
  ['change', AppStateListener]
>;

async function emitAppStateChange(nextAppState: AppStateStatus) {
  await act(async () => {
    mockAppStateListeners.forEach((listener) => listener(nextAppState));
  });
}

const mockedFetchWeatherOverview = jest.mocked(fetchWeatherOverview);
const mockedLoadWeatherCache = jest.mocked(loadWeatherCache);
const mockedHasServicesEnabled = jest.mocked(Location.hasServicesEnabledAsync);
const mockedRequestPermission = jest.mocked(Location.requestForegroundPermissionsAsync);
const mockedGetCurrentPosition = jest.mocked(Location.getCurrentPositionAsync);
const mockedReverseGeocode = jest.mocked(Location.reverseGeocodeAsync);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const GRANTED: LocationPermissionResponse = {
  granted: true,
  canAskAgain: true,
  expires: 'never',
  status: 'granted',
} as LocationPermissionResponse;

const ANKARA_ADDRESS: LocationGeocodedAddress = {
  city: 'Ankara',
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
};

function overview(location: string): WeatherOverview {
  return {
    timezone: 'Europe/Istanbul',
    current: {
      location,
      temperature: 21,
      apparent_temperature: 21,
      humidity: 40,
      wind_speed: 5,
      weather_code: 1,
      time: '2026-09-05T12:00',
    },
    hourly: [],
    daily: [],
    next_rain: null,
  };
}

beforeEach(() => {
  mockAppStateListeners.length = 0;
  mockAddEventListener.mockImplementation((_type, listener) => {
    const subscription = { remove: jest.fn() } as unknown as AppStateSubscription;
    mockAppStateListeners.push(listener);
    subscription.remove.mockImplementation(() => {
      const index = mockAppStateListeners.indexOf(listener);
      if (index >= 0) {
        mockAppStateListeners.splice(index, 1);
      }
    });
    return subscription;
  });

  mockedFetchWeatherOverview.mockResolvedValue(overview('Elazığ'));
  mockedLoadWeatherCache.mockResolvedValue(null);
  mockedHasServicesEnabled.mockResolvedValue(true);
  mockedRequestPermission.mockResolvedValue(GRANTED);
  mockedGetCurrentPosition.mockResolvedValue({
    coords: {
      latitude: 39.9,
      longitude: 32.85,
      altitude: null,
      accuracy: 10,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: 1700000000000,
  });
  mockedReverseGeocode.mockResolvedValue([ANKARA_ADDRESS]);
});

describe('App device location wiring', () => {
  it('keeps the collapsed city selector generic and displays the city in the hero', async () => {
    const { getAllByText, getByRole } = await render(<App />);

    await waitFor(() => expect(getByRole('button', { name: 'Şehir seç' })).toBeOnTheScreen());
    expect(getAllByText('Elazığ')).toHaveLength(1);
  });

  it('feeds a user-initiated GPS fix into the existing weather pipeline', async () => {
    const { getByLabelText, getByText } = await render(<App />);

    await waitFor(() => expect(getByText('Backend: Bağlı')).toBeOnTheScreen());
    expect(mockedFetchWeatherOverview).toHaveBeenCalledWith(
      { name: 'Elazığ', latitude: 38.6743, longitude: 39.2232 },
      expect.anything()
    );

    mockedFetchWeatherOverview.mockResolvedValue(overview('Ankara'));
    await fireEvent.press(getByLabelText('Mevcut konumumu kullan'));

    await waitFor(() =>
      expect(mockedFetchWeatherOverview).toHaveBeenCalledWith(
        { name: 'Ankara', latitude: 39.9, longitude: 32.85 },
        expect.anything()
      )
    );
  });
});

describe('App pull-to-refresh', () => {
  it('invokes the existing refresh exactly once when the user pulls to refresh', async () => {
    const { getByText, getByTestId } = await render(<App />);

    await waitFor(() => expect(getByText('Backend: Bağlı')).toBeOnTheScreen());
    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(1);

    const scrollView = getByTestId('weather-scroll-view');
    const refreshControl = scrollView.props.refreshControl;

    await act(async () => {
      refreshControl.props.onRefresh();
    });

    expect(refreshControl.props.refreshing).toBe(false);
    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(2);
  });

  it('maps loading refreshStatus to RefreshControl refreshing true and keeps the displayed weather present while pending', async () => {
    const initial = deferred<WeatherOverview>();
    mockedFetchWeatherOverview.mockReturnValueOnce(initial.promise);

    const { getByText, getByTestId, queryByText } = await render(<App />);

    await act(async () => {
      initial.resolve(overview('Elazığ'));
    });

    await waitFor(() => expect(getByText('Backend: Bağlı')).toBeOnTheScreen());

    const pending = deferred<WeatherOverview>();
    mockedFetchWeatherOverview.mockReturnValueOnce(pending.promise);

    let scrollView = getByTestId('weather-scroll-view');
    await act(async () => {
      scrollView.props.refreshControl.props.onRefresh();
    });

    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(2);
    expect(getByText(/Bağlantı kontrol ediliyor/)).toBeOnTheScreen();
    expect(queryByText('Backend: Bağlı')).toBeNull();

    scrollView = getByTestId('weather-scroll-view');
    const refreshControl = scrollView.props.refreshControl;
    expect(refreshControl.type).toBe(RefreshControl);
    expect(refreshControl.props.refreshing).toBe(true);
    expect(getByText(/Bağlantı kontrol ediliyor/)).toBeOnTheScreen();
    expect(queryByText('Backend: Bağlı')).toBeNull();
    expect(getByText('21°')).toBeOnTheScreen();

    await act(async () => {
      pending.resolve(overview('Elazığ'));
    });
  });

  it('maps idle refreshStatus to RefreshControl refreshing false', async () => {
    const { getByText, getByTestId } = await render(<App />);

    await waitFor(() => expect(getByText('Backend: Bağlı')).toBeOnTheScreen());

    const scrollView = getByTestId('weather-scroll-view');
    const refreshControl = scrollView.props.refreshControl;
    expect(refreshControl.type).toBe(RefreshControl);
    expect(refreshControl.props.refreshing).toBe(false);
  });

  it('maps error refreshStatus to RefreshControl refreshing false', async () => {
    const { getByText, getByTestId } = await render(<App />);

    await waitFor(() => expect(getByText('Backend: Bağlı')).toBeOnTheScreen());

    mockedFetchWeatherOverview.mockRejectedValueOnce(new Error('offline'));

    const scrollView = getByTestId('weather-scroll-view');
    await act(async () => {
      scrollView.props.refreshControl.props.onRefresh();
    });

    await waitFor(() => {
      const updated = getByTestId('weather-scroll-view');
      expect(updated.props.refreshControl.props.refreshing).toBe(false);
    });

    expect(getByText('21°')).toBeOnTheScreen();
    expect(getByText(/Backend: Bağlantı yok/)).toBeOnTheScreen();

    const refreshControl = getByTestId('weather-scroll-view').props.refreshControl;
    expect(refreshControl.type).toBe(RefreshControl);
    expect(refreshControl.props.refreshing).toBe(false);
  });

  it('shows restored cached weather without claiming a live backend connection', async () => {
    const cachedOverview: WeatherOverview = {
      ...overview('Elazığ'),
      timezone: null,
      hourly: [
        {
          time: '2026-09-04T15:00',
          temperature: 19,
          precipitation: 0.8,
          precipitation_probability: 65,
          weather_code: 61,
          wind_speed: 8,
        },
      ],
      next_rain: {
        start_time: '2026-09-04T14:00',
        end_time: '2026-09-04T15:00',
        total_precipitation: 0.8,
        peak_time: '2026-09-04T14:00',
      },
    };
    const cachedRecord: WeatherCacheRecord = {
      version: 1,
      location: { name: 'Elazığ', latitude: 38.6743, longitude: 39.2232 },
      fetchedAt: new Date('2026-09-04T12:00:00.000Z').getTime(),
      overview: cachedOverview,
    };
    const cacheLoad = deferred<WeatherCacheRecord | null>();
    const initialFetch = deferred<WeatherOverview>();
    mockedLoadWeatherCache.mockReturnValueOnce(cacheLoad.promise);
    mockedFetchWeatherOverview.mockReturnValueOnce(initialFetch.promise);

    const { getByText, queryByText } = await render(<App />);

    await act(async () => {
      cacheLoad.resolve(cachedRecord);
    });

    const expectedLastUpdate = `(Son güncelleme: ${new Date(cachedRecord.fetchedAt).toLocaleString('tr-TR')})`;

    await waitFor(() => expect(getByText(`Bağlantı kontrol ediliyor... ${expectedLastUpdate}`)).toBeOnTheScreen());
    expect(queryByText('Backend: Bağlı')).toBeNull();
    expect(getByText('21°')).toBeOnTheScreen();

    await act(async () => {
      initialFetch.reject(new Error('offline'));
    });

    await waitFor(() => expect(getByText(`Backend: Bağlantı yok ${expectedLastUpdate}`)).toBeOnTheScreen());
    expect(getByText('21°')).toBeOnTheScreen();
    expect(getByText('Tahmin güncel değil. Geri sayım gösterilmiyor.')).toBeOnTheScreen();
    expect(queryByText(/Başlamasına .* kaldı/)).toBeNull();
    expect(getByText('15:00').parent?.props.accessibilityLabel).toBe(
      'Yağış başlangıcı saat 14:00; saatlik sıcaklık saati 15:00, sıcaklık 19°C; 14:00–15:00 aralığında yağış ihtimali %65, yağış miktarı 0.8 mm'
    );
  });
});

describe('App foreground auto-refresh', () => {
  it('does not trigger an extra refresh on initial mount while already active', async () => {
    const { getByText } = await render(<App />);

    await waitFor(() => expect(getByText('Backend: Bağlı')).toBeOnTheScreen());
    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(1);
  });

  it('triggers exactly one refresh on a background to active transition', async () => {
    const { getByText } = await render(<App />);

    await waitFor(() => expect(getByText('Backend: Bağlı')).toBeOnTheScreen());
    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(1);

    await emitAppStateChange('background');
    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(1);

    await emitAppStateChange('active');
    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(2);
  });

  it('triggers exactly one refresh on an inactive to active transition', async () => {
    const { getByText } = await render(<App />);

    await waitFor(() => expect(getByText('Backend: Bağlı')).toBeOnTheScreen());
    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(1);

    await emitAppStateChange('inactive');
    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(1);

    await emitAppStateChange('active');
    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(2);
  });

  it('does not trigger a refresh on an active to active transition', async () => {
    const { getByText } = await render(<App />);

    await waitFor(() => expect(getByText('Backend: Bağlı')).toBeOnTheScreen());
    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(1);

    await emitAppStateChange('active');
    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(1);
  });

  it('removes the AppState listener on unmount', async () => {
    const { getByText, unmount } = await render(<App />);

    await waitFor(() => expect(getByText('Backend: Bağlı')).toBeOnTheScreen());
    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    const subscription = mockAddEventListener.mock.results[mockAddEventListener.mock.results.length - 1]
      .value as AppStateSubscription;
    await act(async () => {
      unmount();
    });

    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });

  it('skips a foreground refresh while refreshStatus is loading and keeps current weather visible', async () => {
    const initial = deferred<WeatherOverview>();
    mockedFetchWeatherOverview.mockReturnValueOnce(initial.promise);

    const { getByText, queryByText } = await render(<App />);

    await act(async () => {
      initial.resolve(overview('Elazığ'));
    });

    await waitFor(() => expect(getByText('Backend: Bağlı')).toBeOnTheScreen());
    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(1);

    const pending = deferred<WeatherOverview>();
    mockedFetchWeatherOverview.mockReturnValueOnce(pending.promise);

    await emitAppStateChange('background');
    await emitAppStateChange('active');

    await waitFor(() => expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(2));

    await emitAppStateChange('background');
    await emitAppStateChange('active');

    expect(mockedFetchWeatherOverview).toHaveBeenCalledTimes(2);
    expect(getByText('21°')).toBeOnTheScreen();
    expect(getByText(/Bağlantı kontrol ediliyor/)).toBeOnTheScreen();
    expect(queryByText('Backend: Bağlı')).toBeNull();

    await act(async () => {
      pending.resolve(overview('Elazığ'));
    });
  });
});
