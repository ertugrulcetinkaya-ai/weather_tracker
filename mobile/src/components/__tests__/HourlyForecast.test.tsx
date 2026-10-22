import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { HourlyForecast } from '../HourlyForecast';
import { calculateTemperaturePointYValues } from '../HourlyWeatherChart';
import type { HourlyWeather } from '../../types/weather';
import { getWeatherTheme } from '../../weather/theme';

function makeHour(
  time: string,
  overrides: Partial<HourlyWeather> = {},
): HourlyWeather {
  return {
    time,
    temperature: 18,
    precipitation: 0,
    precipitation_probability: 0,
    weather_code: 0,
    wind_speed: 5,
    ...overrides,
  };
}

describe('HourlyForecast', () => {
  it('renders hour, temperature, weather and separately labeled rain values', async () => {
    const hourly = [
      makeHour('2024-06-01T13:00', { temperature: 21.4 }),
      makeHour('2024-06-01T14:00', {
        temperature: 19.6,
        precipitation: 1.234,
        precipitation_probability: 35,
        weather_code: 61,
      }),
    ];
    const { getByText, getByTestId } = await render(<HourlyForecast hourly={hourly} />);

    expect(getByText('24 Saatlik Tahmin')).toBeTruthy();
    expect(getByText('Sıcaklık (°C)')).toBeTruthy();
    expect(getByText('Yağış miktarı (mm)')).toBeTruthy();
    expect(getByText('Yağış olasılığı (%)')).toBeTruthy();
    expect(getByText('13:00')).toBeTruthy();
    expect(getByText('14:00')).toBeTruthy();
    expect(getByText('21°')).toBeTruthy();
    expect(getByText('20°')).toBeTruthy();
    expect(getByText('0')).toBeTruthy();
    expect(getByText('1.23')).toBeTruthy();
    expect(getByText('0%', { includeHiddenElements: true })).toBeTruthy();
    expect(getByText('35%', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('hourly-weather-icon-sunny-0', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('hourly-weather-icon-rain-1', { includeHiddenElements: true })).toBeTruthy();
  });

  it('keeps forecast headings and scroll guidance readable on the dark rainy surface', async () => {
    const { getByText } = await render(
      <HourlyForecast
        hourly={[
          makeHour('2024-06-01T13:00', { weather_code: 61 }),
          makeHour('2024-06-01T14:00', { weather_code: 61 }),
        ]}
        theme={getWeatherTheme(61)}
      />,
    );

    expect(StyleSheet.flatten(getByText('24 Saatlik Tahmin').props.style).color).toBe('#F2F7FC');
    expect(StyleSheet.flatten(getByText('Yatay kaydırın →').props.style).color).toBe('#BFD0DE');
  });

  it('renders all 24 records and connects every adjacent temperature sample', async () => {
    const hourly = Array.from({ length: 24 }, (_, index) => {
      const time = new Date(Date.UTC(2024, 5, 1, index)).toISOString().slice(0, 16);
      return makeHour(time, { temperature: index - 12 });
    });
    const { getAllByTestId, getByTestId } = await render(<HourlyForecast hourly={hourly} />);

    expect(getAllByTestId(/^hourly-cell-\d+$/)).toHaveLength(24);
    expect(getAllByTestId(/^hourly-temperature-point-\d+$/, { includeHiddenElements: true })).toHaveLength(24);
    expect(getAllByTestId(/^hourly-temperature-segment-\d+$/, { includeHiddenElements: true })).toHaveLength(23);
    expect(getByTestId('hourly-time-23').props.children).toBe('23:00');
    expect(getByTestId('hourly-cell-23').props.accessibilityLabel).toContain('sıcaklık 11 derece');
    expect(getByTestId('hourly-forecast-scroll').props.horizontal).toBe(true);
  });

  it('scales negative and uneven temperatures across the full chart range', () => {
    expect(calculateTemperaturePointYValues([-10, 0, 10])).toEqual([128, 105, 82]);
    const uneven = calculateTemperaturePointYValues([-10, -8, 3]);
    expect(uneven[0]).toBe(128);
    expect(uneven[1]).toBeCloseTo(120.923, 2);
    expect(uneven[2]).toBe(82);
  });

  it('keeps a flat line for constant temperatures and preserves sharp changes', () => {
    expect(calculateTemperaturePointYValues([-4, -4, -4])).toEqual([105, 105, 105]);
    const sharpChange = calculateTemperaturePointYValues([-30, 80, -29, 79]);
    expect(sharpChange[0]).toBe(128);
    expect(sharpChange[1]).toBe(82);
    expect(sharpChange[2]).toBeCloseTo(127.5818, 3);
    expect(sharpChange[3]).toBeCloseTo(82.4182, 3);
  });

  it('associates the 14:00–15:00 precipitation interval with the 15:00 record', async () => {
    const atFifteen = makeHour('2024-06-01T15:00', {
      temperature: 22.3,
      precipitation: 0.4,
      precipitation_probability: 45,
      weather_code: 61,
    });
    const { getByTestId, getByText } = await render(<HourlyForecast hourly={[atFifteen]} />);

    expect(getByText('15:00')).toBeTruthy();
    expect(getByText('22°')).toBeTruthy();
    expect(getByTestId('hourly-cell-0').props.accessibilityLabel).toContain(
      '14:00–15:00 aralığında yağış miktarı 0.4 mm',
    );
  });

  it('marks rain that starts at 14:00 on the 15:00 record', async () => {
    const atFifteen = makeHour('2024-06-01T15:00', {
      precipitation: 0.4,
      precipitation_probability: 0,
      weather_code: 61,
    });
    const { getByTestId, getByText } = await render(
      <HourlyForecast hourly={[atFifteen]} rainStartTime="2024-06-01T14:00" />,
    );

    expect(getByText(/Yağış başlar 14:00/, { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('rain-start-marker', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('rain-start-bar', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('hourly-cell-0').props.accessibilityLabel).toContain(
      'Yağış başlar 14:00; ilk yağış aralığı 14:00–15:00',
    );
  });

  it('matches rain starts across the 23:00–00:00 boundary', async () => {
    const beforeMidnight = makeHour('2024-06-01T23:00');
    const afterMidnight = makeHour('2024-06-02T00:00', {
      precipitation: 0.2,
      precipitation_probability: 15,
      weather_code: 61,
    });
    const { getByTestId, getByText } = await render(
      <HourlyForecast
        hourly={[beforeMidnight, afterMidnight]}
        rainStartTime="2024-06-01T23:00"
      />,
    );

    expect(getByText('23:00')).toBeTruthy();
    expect(getByText('00:00')).toBeTruthy();
    expect(getByTestId('hourly-cell-1').props.accessibilityLabel).toContain(
      '23:00–00:00 aralığında',
    );
    expect(getByTestId('rain-start-bar', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows zero probability alongside positive precipitation without treating it as an error', async () => {
    const drizzle = makeHour('2024-06-01T14:00', {
      precipitation: 0.01,
      precipitation_probability: 0,
      weather_code: 51,
    });
    const { getByTestId, getByText } = await render(<HourlyForecast hourly={[drizzle]} />);

    expect(getByText('0%', { includeHiddenElements: true })).toBeTruthy();
    expect(getByText('0.01')).toBeTruthy();
    expect(getByTestId('hourly-cell-0').props.accessibilityLabel).toContain(
      'yağış olasılığı %0',
    );
    expect(getByTestId('hourly-cell-0').props.accessibilityLabel).toContain(
      '13:00–14:00 aralığında yağış miktarı 0.01 mm',
    );
  });

  it('preserves positive trace precipitation using formatPrecipitation', async () => {
    const trace = makeHour('2024-06-01T14:00', {
      precipitation: 0.004,
      weather_code: 61,
    });
    const { getByText, getByTestId } = await render(
      <HourlyForecast hourly={[trace]} rainStartTime="2024-06-01T13:00" />,
    );

    expect(getByText('<0.01')).toBeTruthy();
    expect(getByTestId('rain-start-marker', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('hourly-cell-0').props.accessibilityLabel).toContain(
      'yağış miktarı <0.01 mm',
    );
  });

  it('uses distinct rain and snow glyphs and preserves the WMO condition labels', async () => {
    const hourly = [
      makeHour('2024-06-01T13:00', { weather_code: 61, precipitation: 0.4 }),
      makeHour('2024-06-01T14:00', { weather_code: 71, precipitation: 0.2 }),
    ];
    const { getByTestId } = await render(<HourlyForecast hourly={hourly} />);

    expect(getByTestId('hourly-weather-icon-rain-0', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('hourly-weather-icon-snow-1', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('hourly-cell-0').props.accessibilityLabel).toContain('hava durumu: Yağmurlu');
    expect(getByTestId('hourly-cell-1').props.accessibilityLabel).toContain('hava durumu: Karlı');
  });

  it.each([
    [0, 'sunny'],
    [1, 'sunny'],
    [2, 'cloudy'],
    [3, 'cloudy'],
    [45, 'fog'],
    [48, 'fog'],
    [51, 'rain'],
    [67, 'rain'],
    [80, 'rain'],
    [82, 'rain'],
    [71, 'snow'],
    [86, 'snow'],
    [95, 'storm'],
    [99, 'storm'],
    [999, 'neutral'],
  ] as const)('maps WMO %i to the %s symbol family', async (weatherCode, kind) => {
    const { getByTestId } = await render(
      <HourlyForecast hourly={[makeHour('2024-06-01T13:00', { weather_code: weatherCode })]} />,
    );

    expect(getByTestId(`hourly-weather-icon-${kind}-0`, { includeHiddenElements: true })).toBeTruthy();
  });

  it('uses a neutral glyph for an unknown WMO code', async () => {
    const { getByTestId } = await render(
      <HourlyForecast hourly={[makeHour('2024-06-01T13:00', { weather_code: 999 })]} />,
    );

    expect(getByTestId('hourly-weather-icon-neutral-0', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('hourly-cell-0').props.accessibilityLabel).toContain(
      'hava durumu: Hava durumu',
    );
  });

  it('handles one record and an empty list without rendering a broken graph', async () => {
    const one = await render(<HourlyForecast hourly={[makeHour('2024-06-01T13:00')]} />);
    expect(one.getByTestId('hourly-temperature-point-0', { includeHiddenElements: true })).toBeTruthy();
    expect(one.queryByTestId('hourly-temperature-segment-0', { includeHiddenElements: true })).toBeNull();

    const empty = await render(<HourlyForecast hourly={[]} />);
    expect(empty.getByTestId('hourly-empty-state')).toBeTruthy();
    expect(empty.queryByTestId('hourly-forecast-scroll')).toBeNull();
  });

  it('does not mark a rain start when the matching record is dry or no record matches', async () => {
    const dryRecord = makeHour('2024-06-01T15:00', { precipitation: 0 });
    const dry = await render(
      <HourlyForecast hourly={[dryRecord]} rainStartTime="2024-06-01T14:00" />,
    );
    expect(dry.queryByTestId('rain-start-marker', { includeHiddenElements: true })).toBeNull();
    expect(dry.queryByText(/Yağış başlar/, { includeHiddenElements: true })).toBeNull();

    const wetRecord = makeHour('2024-06-01T15:00', { precipitation: 0.2, weather_code: 61 });
    const unmatched = await render(
      <HourlyForecast hourly={[wetRecord]} rainStartTime="2024-06-01T12:00" />,
    );
    expect(unmatched.queryByTestId('rain-start-marker', { includeHiddenElements: true })).toBeNull();
    expect(unmatched.queryByText(/Yağış başlar/, { includeHiddenElements: true })).toBeNull();
  });

  it('allows system text scaling and keeps hourly labels at least 12 sp', async () => {
    const { getByTestId, getByText } = await render(
      <HourlyForecast hourly={[makeHour('2024-06-01T13:00')]} />,
    );

    for (const testID of ['hourly-time-0', 'hourly-temperature-label-0', 'hourly-precipitation-amount-0']) {
      expect(getByTestId(testID).props.allowFontScaling).not.toBe(false);
      expect(StyleSheet.flatten(getByTestId(testID).props.style).fontSize).toBeGreaterThanOrEqual(12);
    }
    expect(getByText('24 Saatlik Tahmin').props.allowFontScaling).not.toBe(false);
    expect(getByText('Sıcaklık (°C)').props.allowFontScaling).not.toBe(false);
  });

  it('exposes one complete, non-duplicated TalkBack label per hour', async () => {
    const hourly = [
      makeHour('2024-06-01T15:00', {
        temperature: -2.4,
        precipitation: 0.25,
        precipitation_probability: 20,
        weather_code: 61,
      }),
      makeHour('2024-06-01T16:00'),
    ];
    const { getAllByTestId, getByTestId } = await render(
      <HourlyForecast hourly={hourly} rainStartTime="2024-06-01T14:00" />,
    );
    const firstCell = getByTestId('hourly-cell-0');
    const label = firstCell.props.accessibilityLabel as string;

    expect(getAllByTestId(/^hourly-cell-\d+$/)).toHaveLength(2);
    expect(firstCell.props.accessible).toBe(true);
    expect(label).toContain('Saat 15:00');
    expect(label).toContain('sıcaklık -2 derece');
    expect(label).toContain('hava durumu: Yağmurlu');
    expect(label).toContain('yağış olasılığı %20');
    expect(label).toContain('14:00–15:00 aralığında yağış miktarı 0.25 mm');
    expect(label).toContain('Yağış başlar 14:00');
    expect(getByTestId('hourly-temperature-segment-0', { includeHiddenElements: true }).props.accessible).toBe(false);
    expect(getByTestId('hourly-weather-icon-rain-0', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
  });

  it('updates its chart when the parent provides a new city forecast', async () => {
    const initial = makeHour('2024-06-01T13:00', { temperature: 21 });
    const nextCity = makeHour('2024-06-01T13:00', { temperature: 9, weather_code: 71 });
    const screen = await render(<HourlyForecast hourly={[initial]} />);

    expect(screen.getByTestId('hourly-cell-0').props.accessibilityLabel).toContain(
      'sıcaklık 21 derece',
    );
    await screen.rerender(<HourlyForecast hourly={[nextCity]} />);

    expect(screen.getByTestId('hourly-cell-0').props.accessibilityLabel).toContain(
      'sıcaklık 9 derece',
    );
    expect(screen.getByTestId('hourly-weather-icon-snow-0', { includeHiddenElements: true })).toBeTruthy();
  });

  it('renders a cached 24-hour forecast through the same chart layout', async () => {
    const cachedHourly = Array.from({ length: 24 }, (_, index) => {
      const time = new Date(Date.UTC(2024, 5, 1, index)).toISOString().slice(0, 16);
      return makeHour(time, { temperature: 4 + index / 2 });
    });
    const { getAllByTestId, getByTestId } = await render(
      <HourlyForecast hourly={cachedHourly} />,
    );

    expect(getAllByTestId(/^hourly-cell-\d+$/)).toHaveLength(24);
    expect(getByTestId('hourly-time-23').props.children).toBe('23:00');
  });
});
