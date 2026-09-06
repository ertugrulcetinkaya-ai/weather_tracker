import * as Location from 'expo-location';
import { AppState, RefreshControl } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { fetchWeatherOverview } from '../api/weather';
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
const mockedHasServicesEnabled = jest.mocked(Location.hasServicesEnabledAsync);
const mockedRequestPermission = jest.mocked(Location.requestForegroundPermissionsAsync);
const mockedGetCurrentPosition = jest.mocked(Location.getCurrentPositionAsync);
const mockedReverseGeocode = jest.mocked(Location.reverseGeocodeAsync);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
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
  it('feeds a user-initiated GPS fix into the existing weather pipeline', async () => {
    const { getByText } = await render(<App />);

    await waitFor(() => expect(getByText('Backend: Bağlı')).toBeOnTheScreen());
    expect(mockedFetchWeatherOverview).toHaveBeenCalledWith(
      { name: 'Elazığ', latitude: 38.6743, longitude: 39.2232 },
      expect.anything()
    );

    mockedFetchWeatherOverview.mockResolvedValue(overview('Ankara'));
    await fireEvent.press(getByText('📍 Mevcut konumum'));

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

    const { getByText, getByTestId } = await render(<App />);

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
    expect(getByText('Backend: Bağlı')).toBeOnTheScreen();

    scrollView = getByTestId('weather-scroll-view');
    const refreshControl = scrollView.props.refreshControl;
    expect(refreshControl.type).toBe(RefreshControl);
    expect(refreshControl.props.refreshing).toBe(true);
    expect(getByText('Backend: Bağlı')).toBeOnTheScreen();
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

    const refreshControl = getByTestId('weather-scroll-view').props.refreshControl;
    expect(refreshControl.type).toBe(RefreshControl);
    expect(refreshControl.props.refreshing).toBe(false);
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

    const { getByText } = await render(<App />);

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
    expect(getByText('Backend: Bağlı')).toBeOnTheScreen();

    await act(async () => {
      pending.resolve(overview('Elazığ'));
    });
  });
});
