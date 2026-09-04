import { requestJson } from '../client';
import { fetchWeatherOverview, searchLocations } from '../weather';

jest.mock('../client', () => ({
  requestJson: jest.fn(),
}));

const mockedRequestJson = jest.mocked(requestJson);

const hourly = Array.from({ length: 24 }, (_unused, index) => ({
  time: `2026-08-30T${String(index).padStart(2, '0')}:00`,
  temperature: 24.5,
  precipitation: 0,
  precipitation_probability: 35,
  weather_code: 2,
  wind_speed: 12.2,
}));

const daily = [
  '2026-08-30',
  '2026-08-31',
  '2026-09-01',
  '2026-09-02',
  '2026-09-03',
  '2026-09-04',
  '2026-09-05',
].map((date) => ({
  date,
  temperature_max: 30.5,
  temperature_min: 18.25,
  precipitation: 0,
  precipitation_probability: 35,
  weather_code: 2,
}));

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
  hourly,
  daily,
  next_rain: null,
};

function withHourly(mutate: (record: Record<string, unknown>) => Record<string, unknown>) {
  return {
    ...overviewPayload,
    hourly: hourly.map((record) => mutate({ ...record })),
  };
}

function withDaily(mutate: (record: Record<string, unknown>) => Record<string, unknown>) {
  return {
    ...overviewPayload,
    daily: daily.map((record) => mutate({ ...record })),
  };
}

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

  test('accepts integral probabilities at the range boundaries', async () => {
    mockedRequestJson.mockResolvedValue({
      ...withHourly((record) => ({ ...record, precipitation_probability: 0 })),
      daily: withDaily((record) => ({ ...record, precipitation_probability: 100 }))
        .daily,
    });

    const overview = await fetchWeatherOverview({
      name: 'İstanbul',
      latitude: 41,
      longitude: 29,
    });
    expect(overview.hourly[0]?.precipitation_probability).toBe(0);
    expect(overview.daily[0]?.precipitation_probability).toBe(100);
    expect(overview.daily).toHaveLength(7);
  });

  test.each([
    ['empty hourly forecast', { ...overviewPayload, hourly: [] }],
    [
      'shorter hourly forecast',
      { ...overviewPayload, hourly: hourly.slice(0, 23) },
    ],
    [
      'longer hourly forecast',
      { ...overviewPayload, hourly: [...hourly, { ...hourly[0] }] },
    ],
    ['missing daily forecast', { ...overviewPayload, daily: [] }],
    [
      'shorter daily forecast',
      { ...overviewPayload, daily: daily.slice(0, 6) },
    ],
    [
      'non-numeric hourly temperature',
      withHourly((record) => ({ ...record, temperature: '24.5' })),
    ],
    [
      'non-numeric hourly probability',
      withHourly((record) => ({ ...record, precipitation_probability: '35' })),
    ],
    [
      'fractional hourly probability',
      withHourly((record) => ({ ...record, precipitation_probability: 35.5 })),
    ],
    [
      'out-of-range hourly probability',
      withHourly((record) => ({ ...record, precipitation_probability: 101 })),
    ],
    [
      'negative hourly probability',
      withHourly((record) => ({ ...record, precipitation_probability: -1 })),
    ],
    [
      'missing daily date',
      withDaily((record) => ({ ...record, date: '' })),
    ],
    [
      'non-string daily date',
      withDaily((record) => ({ ...record, date: 20260830 })),
    ],
    [
      'non-finite daily maximum temperature',
      withDaily((record) => ({ ...record, temperature_max: '30.5' })),
    ],
    [
      'non-finite daily precipitation',
      withDaily((record) => ({ ...record, precipitation: null })),
    ],
    [
      'fractional daily probability',
      withDaily((record) => ({ ...record, precipitation_probability: 35.5 })),
    ],
    [
      'out-of-range daily probability',
      withDaily((record) => ({ ...record, precipitation_probability: 101 })),
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
