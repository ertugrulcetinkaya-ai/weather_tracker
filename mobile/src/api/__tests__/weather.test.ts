import { requestJson } from '../client';
import { fetchWeatherOverview, searchLocations } from '../weather';

jest.mock('../client', () => ({
  requestJson: jest.fn(),
}));

const mockedRequestJson = jest.mocked(requestJson);

const overviewPayload = {
  current: {
    location: 'İstanbul',
    temperature: 24.5,
    apparent_temperature: 25.1,
    humidity: 58,
    wind_speed: 12.2,
    weather_code: 2,
    time: '2026-08-30T12:00',
  },
  hourly: [
    {
      time: '2026-08-30T12:00',
      temperature: 24.5,
      precipitation: 0,
      weather_code: 2,
      wind_speed: 12.2,
    },
  ],
  next_rain: null,
};

beforeEach(() => {
  mockedRequestJson.mockReset();
});

describe('weather API contract', () => {
  test('builds an encoded overview request and validates the response', async () => {
    mockedRequestJson.mockResolvedValue(overviewPayload);
    const controller = new AbortController();

    await expect(
      fetchWeatherOverview(
        { name: 'İstanbul Avrupa', latitude: 41.0082, longitude: 28.9784 },
        controller.signal
      )
    ).resolves.toEqual(overviewPayload);

    expect(mockedRequestJson).toHaveBeenCalledWith(
      expect.stringContaining('/weather/overview?'),
      { signal: controller.signal }
    );
    const path = mockedRequestJson.mock.calls[0]?.[0] ?? '';
    expect(path).toContain('latitude=41.0082');
    expect(path).toContain('longitude=28.9784');
    expect(path).toContain('location=%C4%B0stanbul+Avrupa');
  });

  test.each([
    ['empty hourly forecast', { ...overviewPayload, hourly: [] }],
    [
      'non-numeric hourly temperature',
      {
        ...overviewPayload,
        hourly: [{ ...overviewPayload.hourly[0], temperature: '24.5' }],
      },
    ],
    [
      'malformed rain event',
      {
        ...overviewPayload,
        next_rain: { start_time: '2026-08-30T13:00' },
      },
    ],
  ])('rejects a %s', async (_caseName, payload) => {
    mockedRequestJson.mockResolvedValue(payload);

    await expect(
      fetchWeatherOverview({ name: 'İstanbul', latitude: 41, longitude: 29 })
    ).rejects.toThrow('Unexpected');
  });

  test('validates every location search result and coordinate range', async () => {
    mockedRequestJson.mockResolvedValue([
      {
        name: 'Ankara',
        latitude: 39.9334,
        longitude: 32.8597,
        admin1: 'Ankara',
        country: 'Türkiye',
      },
    ]);

    await expect(searchLocations('ankara')).resolves.toHaveLength(1);
    expect(mockedRequestJson).toHaveBeenCalledWith('/locations/search?q=ankara', {
      signal: undefined,
    });

    mockedRequestJson.mockResolvedValue([
      {
        name: 'Invalid',
        latitude: 120,
        longitude: 32,
        admin1: null,
        country: 'Türkiye',
      },
    ]);
    await expect(searchLocations('invalid')).rejects.toThrow(
      'Unexpected location search response'
    );
  });

  test('rejects a non-array search payload', async () => {
    mockedRequestJson.mockResolvedValue({ results: [] });

    await expect(searchLocations('ankara')).rejects.toThrow(
      'Unexpected location search response'
    );
  });
});
