import * as Location from 'expo-location';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

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

const mockedFetchWeatherOverview = jest.mocked(fetchWeatherOverview);
const mockedHasServicesEnabled = jest.mocked(Location.hasServicesEnabledAsync);
const mockedRequestPermission = jest.mocked(Location.requestForegroundPermissionsAsync);
const mockedGetCurrentPosition = jest.mocked(Location.getCurrentPositionAsync);
const mockedReverseGeocode = jest.mocked(Location.reverseGeocodeAsync);

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
