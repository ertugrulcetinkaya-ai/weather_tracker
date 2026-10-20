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

  it('marks the record for the interval beginning at rainStartTime', async () => {
    const { getAllByText, getByText } = await render(
      <HourlyForecast hourly={hourly} rainStartTime="2024-06-01T13:00" />
    );

    const markedCard = getByText('14:00').parent;
    expect(markedCard?.props.accessibilityLabel).toBe(
      'Yağış başlangıcı saat 13:00; saatlik sıcaklık saati 14:00, sıcaklık 20°C; 13:00–14:00 aralığında yağış ihtimali %35, yağış miktarı 1.23 mm'
    );
    expect(markedCard?.props.accessible).toBe(true);

    const unmarkedCard = getAllByText('13:00')[0].parent;
    expect(unmarkedCard?.props.accessible).toBe(false);
    expect(unmarkedCard?.props.accessibilityLabel).toBe('');
  });

  it('shows the 14:00 rain start on the 15:00 temperature card', async () => {
    const hourAtFifteen = { ...hourly[1], time: '2024-06-01T15:00' };
    const { getByText, getByTestId } = await render(
      <HourlyForecast hourly={[hourAtFifteen]} rainStartTime="2024-06-01T14:00" />
    );
    const markedCard = getByText('15:00').parent;

    expect(getByText('20°C')).toBeTruthy();
    expect(getByText('Yağış başlar')).toBeTruthy();
    expect(getByTestId('rain-start-marker')).toBeTruthy();
    expect(getByText('14:00')).toBeTruthy();
    expect(markedCard?.props.accessibilityLabel).toContain('14:00–15:00 aralığında');
  });

  it('shows the start marker for small positive precipitation', async () => {
    const lightRainHour = { ...hourly[1], precipitation: 0.01 };
    const { getByText, getByTestId } = await render(
      <HourlyForecast hourly={[lightRainHour]} rainStartTime="2024-06-01T13:00" />
    );

    expect(getByText('0.01 mm')).toBeTruthy();
    expect(getByTestId('rain-start-marker')).toBeTruthy();
  });

  it('does not show a rain start marker on a dry card', async () => {
    const dryHour = { ...hourly[1], precipitation: 0 };
    const { getByText, queryByTestId } = await render(
      <HourlyForecast hourly={[dryHour]} rainStartTime="2024-06-01T13:00" />
    );

    const card = getByText('14:00').parent;
    expect(queryByTestId('rain-start-marker')).toBeNull();
    expect(card?.props.accessible).toBe(false);
    expect(card?.props.accessibilityLabel).toBe('');
  });

  it('preserves card dimensions 72x150 on the marked card', async () => {
    const { getByText } = await render(
      <HourlyForecast hourly={hourly} rainStartTime="2024-06-01T13:00" />
    );
    const markedCard = getByText('14:00').parent;

    expect(markedCard).toBeTruthy();
    expect(markedCard?.props.style).toEqual([
      expect.objectContaining({ width: 72, height: 150 }),
      expect.objectContaining({ borderWidth: 2 }),
    ]);
  });

  it('does not mark any card when rainStartTime is null', async () => {
    const { getByText, queryByTestId } = await render(
      <HourlyForecast hourly={hourly} rainStartTime={null} />
    );

    expect(queryByTestId('rain-start-marker')).toBeNull();
    expect(getByText('13:00').parent?.props.accessibilityLabel).toBe('');
    expect(getByText('14:00').parent?.props.accessibilityLabel).toBe('');
  });

  it('does not mark any card when rainStartTime does not match any hour.time', async () => {
    const { getByText, queryByTestId } = await render(
      <HourlyForecast hourly={hourly} rainStartTime="2024-06-01T15:00" />
    );

    expect(queryByTestId('rain-start-marker')).toBeNull();
    expect(getByText('13:00').parent?.props.accessibilityLabel).toBe('');
    expect(getByText('14:00').parent?.props.accessibilityLabel).toBe('');
  });

  it('matches the rain interval across midnight without using the device timezone', async () => {
    const afterMidnight = [
      ...hourly,
      {
        time: '2024-06-02T00:00',
        temperature: 18.2,
        precipitation: 0.2,
        precipitation_probability: 15,
        weather_code: 61,
        wind_speed: 6.0,
      },
    ];
    const { getByText, getByTestId } = await render(
      <HourlyForecast hourly={afterMidnight} rainStartTime="2024-06-01T23:00" />
    );

    const markedCard = getByText('00:00').parent;
    expect(markedCard?.props.accessible).toBe(true);
    expect(markedCard?.props.accessibilityLabel).toContain(
      'Yağış başlangıcı saat 23:00'
    );
    expect(markedCard?.props.accessibilityLabel).toContain('saatlik sıcaklık saati 00:00');
    expect(markedCard?.props.accessibilityLabel).toContain('23:00–00:00');
    expect(getByText('23:00')).toBeTruthy();
  });
});
