import React from 'react';
import { render } from '@testing-library/react-native';

import { DailyForecast } from '../DailyForecast';
import type { DailyWeather } from '../../types/weather';

const DAILY: DailyWeather[] = [
  {
    date: '2026-08-30',
    temperature_max: 30.4,
    temperature_min: 18.2,
    precipitation: 0,
    precipitation_probability: 5,
    weather_code: 0,
  },
  {
    date: '2026-08-31',
    temperature_max: 29.6,
    temperature_min: 19.4,
    precipitation: 1.234,
    precipitation_probability: 65,
    weather_code: 61,
  },
  {
    date: '2026-09-01',
    temperature_max: 27.1,
    temperature_min: 16.4,
    precipitation: 0.1,
    precipitation_probability: 30,
    weather_code: 2,
  },
  {
    date: '2026-09-02',
    temperature_max: 25.9,
    temperature_min: 15.2,
    precipitation: 8.05,
    precipitation_probability: 92,
    weather_code: 63,
  },
  {
    date: '2026-09-03',
    temperature_max: 28.5,
    temperature_min: 17.0,
    precipitation: 0,
    precipitation_probability: 0,
    weather_code: 3,
  },
  {
    date: '2026-09-04',
    temperature_max: 31.2,
    temperature_min: 20.6,
    precipitation: 0,
    precipitation_probability: 100,
    weather_code: 1,
  },
  {
    date: '2026-09-05',
    temperature_max: 33.7,
    temperature_min: 22.1,
    precipitation: 0,
    precipitation_probability: 8,
    weather_code: 45,
  },
];

describe('DailyForecast', () => {
  it('renders the section header exactly once', async () => {
    const { getAllByText } = await render(<DailyForecast daily={DAILY} />);

    expect(getAllByText('7 Günlük Tahmin')).toHaveLength(1);
  });

  it('renders one row per day with a Turkish day/date label', async () => {
    const { getByText, queryByText } = await render(<DailyForecast daily={DAILY} />);

    // Weekdays and month abbreviations are derived from the calendar date
    // itself, so they never depend on the device timezone or locale.
    expect(getByText('Pazar, 30 Ağu')).toBeTruthy();
    expect(getByText('Pazartesi, 31 Ağu')).toBeTruthy();
    expect(getByText('Salı, 1 Eyl')).toBeTruthy();
    expect(getByText('Çarşamba, 2 Eyl')).toBeTruthy();
    expect(getByText('Perşembe, 3 Eyl')).toBeTruthy();
    expect(getByText('Cuma, 4 Eyl')).toBeTruthy();
    expect(getByText('Cumartesi, 5 Eyl')).toBeTruthy();

    // The raw ISO date is never surfaced to the user.
    expect(queryByText('2026-08-30')).toBeNull();
  });

  it.each(['30.08.2026', '2026-45-01'])(
    'falls back to the raw date for the unlabelled date %s',
    async (date) => {
      const { getByText } = await render(
        <DailyForecast daily={[{ ...DAILY[0], date }]}
      />);

      expect(getByText(date)).toBeTruthy();
    }
  );

  it('shows the WMO condition emoji and label together with rounded temperatures', async () => {
    const { getAllByText, getByText } = await render(<DailyForecast daily={DAILY} />);

    // WMO-mapped representations: code 0 -> ☀️ Açık, code 61 -> 🌧️ Yağmurlu.
    expect(getAllByText('☀️')).toHaveLength(1);
    expect(getAllByText('Açık')).toHaveLength(1);
    expect(getAllByText('🌧️')).toHaveLength(2);
    expect(getAllByText('Yağmurlu')).toHaveLength(2);
    expect(getAllByText('🌫️')).toHaveLength(1);
    expect(getAllByText('Sisli')).toHaveLength(1);

    expect(getByText('18° / 30°')).toBeTruthy();
    expect(getByText('19° / 30°')).toBeTruthy();
    expect(getByText('16° / 27°')).toBeTruthy();
    expect(getByText('22° / 34°')).toBeTruthy();
  });

  it('shows the real precipitation probability for every day', async () => {
    const { getByText } = await render(<DailyForecast daily={DAILY} />);

    expect(getByText('Yağış %5')).toBeTruthy();
    expect(getByText('Yağış %65')).toBeTruthy();
    expect(getByText('Yağış %30')).toBeTruthy();
    expect(getByText('Yağış %92')).toBeTruthy();
    expect(getByText('Yağış %0')).toBeTruthy();
    expect(getByText('Yağış %100')).toBeTruthy();
    expect(getByText('Yağış %8')).toBeTruthy();
  });

  it('shows precipitation amounts only for days with measurable rain', async () => {
    const { getByText, queryByText } = await render(<DailyForecast daily={DAILY} />);

    expect(getByText('1.23 mm')).toBeTruthy();
    expect(getByText('0.1 mm')).toBeTruthy();
    expect(getByText('8.05 mm')).toBeTruthy();

    // Days without precipitation render no amount line at all.
    expect(queryByText('0 mm')).toBeNull();
  });

  it('uses the unknown-WMO fallback condition', async () => {
    const { getByText } = await render(
      <DailyForecast daily={[{ ...DAILY[0], weather_code: 4242 }]}
    />);

    expect(getByText('🌡️')).toBeTruthy();
    expect(getByText('Hava durumu')).toBeTruthy();
  });

  it('renders no day rows when the daily list is empty', async () => {
    const { getAllByText, queryByText } = await render(<DailyForecast daily={[]} />);

    expect(getAllByText('7 Günlük Tahmin')).toHaveLength(1);
    expect(queryByText('Pazar, 30 Ağu')).toBeNull();
  });
});
