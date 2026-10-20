import React from 'react';
import { render } from '@testing-library/react-native';

import { HourlyForecast } from '../HourlyForecast';
import type { HourlyWeather } from '../../types/weather';

describe('HourlyForecast', () => {
  const hourly: HourlyWeather[] = [
    {
      time: '2024-06-01T13:00',
      temperature: 21.4,
      precipitation: 0,
      precipitation_probability: 0,
      weather_code: 0,
      wind_speed: 5.2,
    },
    {
      time: '2024-06-01T14:00',
      temperature: 19.6,
      precipitation: 1.234,
      precipitation_probability: 35,
      weather_code: 61,
      wind_speed: 8.7,
    },
  ];

  it('renders an entry for every hourly record with hour, rounded temperature, precipitation and WMO-mapped emoji', async () => {
    const { getAllByText, getByText } = await render(<HourlyForecast hourly={hourly} />);

    // One title plus one card per record.
    expect(getAllByText('Saatlik Tahmin')).toHaveLength(1);

    // Hour (HH from ISO time slice 11..16).
    expect(getByText('13:00')).toBeTruthy();
    expect(getByText('14:00')).toBeTruthy();

    // Rounded temperature.
    expect(getByText('21°C')).toBeTruthy();
    expect(getByText('20°C')).toBeTruthy();

    // Precipitation.
    expect(getByText('0 mm')).toBeTruthy();
    expect(getByText('1.23 mm')).toBeTruthy();

    // Precipitation probability straight from the provider.
    expect(getByText('Yağış %0')).toBeTruthy();
    expect(getByText('Yağış %35')).toBeTruthy();

    // WMO-mapped emoji representations: code 0 -> ☀️, code 61 -> 🌧️.
    expect(getAllByText('☀️')).toHaveLength(1);
    expect(getAllByText('🌧️')).toHaveLength(1);
  });

  it('renders no hourly cards when the hourly list is empty', async () => {
    const { queryByText } = await render(<HourlyForecast hourly={[]} />);

    expect(queryByText('13:00')).toBeNull();
    expect(queryByText('14:00')).toBeNull();
  });

  it('marks exactly the first card whose hour.time equals rainStartTime', async () => {
    const { getByText } = await render(
      <HourlyForecast hourly={hourly} rainStartTime="2024-06-01T14:00" />
    );

    const markedCard = getByText('14:00').parent;
    expect(markedCard?.props.accessibilityLabel).toBe(
      'Yağış başlangıcı, saat 14:00, sıcaklık 20°C, yağış ihtimali %35, yağış miktarı 1.23 mm'
    );
    expect(markedCard?.props.accessible).toBe(true);

    const unmarkedCard = getByText('13:00').parent;
    expect(unmarkedCard?.props.accessible).toBe(false);
    expect(unmarkedCard?.props.accessibilityLabel).toBe('');
  });

  it('preserves card dimensions 72x150 on the marked card', async () => {
    const { getByText } = await render(
      <HourlyForecast hourly={hourly} rainStartTime="2024-06-01T14:00" />
    );
    const markedCard = getByText('14:00').parent;

    expect(markedCard).toBeTruthy();
    expect(markedCard?.props.style).toEqual([
      expect.objectContaining({ width: 72, height: 150 }),
      expect.objectContaining({ borderWidth: 2 }),
    ]);
  });

  it('does not mark any card when rainStartTime is null', async () => {
    const { getByText } = await render(
      <HourlyForecast hourly={hourly} rainStartTime={null} />
    );

    expect(getByText('13:00').parent?.props.accessibilityLabel).toBe('');
    expect(getByText('14:00').parent?.props.accessibilityLabel).toBe('');
  });

  it('does not mark any card when rainStartTime does not match any hour.time', async () => {
    const { getByText } = await render(
      <HourlyForecast hourly={hourly} rainStartTime="2024-06-01T15:00" />
    );

    expect(getByText('13:00').parent?.props.accessibilityLabel).toBe('');
    expect(getByText('14:00').parent?.props.accessibilityLabel).toBe('');
  });
});
