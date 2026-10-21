import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { DailyForecast } from '../DailyForecast';
import type { DailyWeather } from '../../types/weather';
import { getWeatherTheme } from '../../weather/theme';
import { getWeatherGlyphKind } from '../WeatherGlyph';

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
    temperature_min: 17,
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

function withTemperatures(
  temperature_min: number,
  temperature_max: number,
  date = '2026-01-01',
): DailyWeather {
  return {
    ...DAILY[0],
    date,
    temperature_min,
    temperature_max,
  };
}

describe('DailyForecast', () => {
  it('renders all seven daily rows and the section heading', async () => {
    const { getAllByTestId, getAllByText } = await render(<DailyForecast daily={DAILY} />);

    expect(getAllByText('7 Günlük Tahmin')).toHaveLength(1);
    expect(getAllByTestId(/^daily-forecast-row-\d+$/)).toHaveLength(7);
  });

  it('renders a short forecast without padding it with invented days', async () => {
    const { getAllByTestId, queryByTestId } = await render(
      <DailyForecast daily={[DAILY[0]]} />,
    );

    expect(getAllByTestId(/^daily-forecast-row-\d+$/)).toHaveLength(1);
    expect(queryByTestId('daily-forecast-row-1')).toBeNull();
  });

  it('keeps Turkish weekday/date labels tied to the provider calendar date', async () => {
    const { getByText, queryByText } = await render(<DailyForecast daily={DAILY} />);

    expect(getByText('Pazar, 30 Ağu')).toBeTruthy();
    expect(getByText('Pazartesi, 31 Ağu')).toBeTruthy();
    expect(getByText('Salı, 1 Eyl')).toBeTruthy();
    expect(getByText('Çarşamba, 2 Eyl')).toBeTruthy();
    expect(getByText('Perşembe, 3 Eyl')).toBeTruthy();
    expect(getByText('Cuma, 4 Eyl')).toBeTruthy();
    expect(getByText('Cumartesi, 5 Eyl')).toBeTruthy();
    expect(queryByText('2026-08-30')).toBeNull();
  });

  it.each([
    ['2024-02-29', 'Perşembe, 29 Şub'],
    ['2024-12-31', 'Salı, 31 Ara'],
    ['2025-01-01', 'Çarşamba, 1 Oca'],
    ['2028-02-29', 'Salı, 29 Şub'],
  ])('formats leap-year and year-boundary date %s', async (date, expected) => {
    const { getByText } = await render(<DailyForecast daily={[{ ...DAILY[0], date }]} />);

    expect(getByText(expected)).toBeTruthy();
  });

  it.each(['2026-02-30', '2026-45-01', '30.08.2026'])
    ('leaves invalid date %s unnormalized', async (date) => {
      const { getByText, queryByText } = await render(
        <DailyForecast daily={[{ ...DAILY[0], date }]} />,
      );

      expect(getByText(date)).toBeTruthy();
      expect(queryByText('Pazartesi, 2 Mar')).toBeNull();
    });

  it('shows the existing custom WMO glyphs and labels for sun, rain, snow, fog, storms and unknown codes', async () => {
    const codes = [0, 61, 71, 45, 95, 4242];
    const daily = codes.map((weather_code, index) => ({
      ...DAILY[0],
      date: `2026-09-0${index + 1}`,
      weather_code,
    }));
    const { getByTestId, getByText } = await render(<DailyForecast daily={daily} />);

    expect(getByTestId('daily-weather-icon-sunny-0', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('daily-weather-icon-rain-1', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('daily-weather-icon-snow-2', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('daily-weather-icon-fog-3', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('daily-weather-icon-storm-4', { includeHiddenElements: true })).toBeTruthy();
    expect(getByTestId('daily-weather-icon-neutral-5', { includeHiddenElements: true })).toBeTruthy();
    expect(getByText('Açık')).toBeTruthy();
    expect(getByText('Yağmurlu')).toBeTruthy();
    expect(getByText('Karlı')).toBeTruthy();
    expect(getByText('Sisli')).toBeTruthy();
    expect(getByText('Gök gürültülü fırtına')).toBeTruthy();
    expect(getByText('Hava durumu')).toBeTruthy();
    expect(getWeatherGlyphKind(66)).toBe('rain');
    expect(getWeatherGlyphKind(67)).toBe('rain');
  });

  it('keeps WMO 61 rain and WMO 71 snow on separate glyph shapes', async () => {
    const { getByTestId } = await render(
      <DailyForecast
        daily={[
          { ...DAILY[0], weather_code: 61 },
          { ...DAILY[1], weather_code: 71 },
        ]}
      />,
    );

    const rain = getByTestId('daily-weather-icon-rain-0', { includeHiddenElements: true });
    const snow = getByTestId('daily-weather-icon-snow-1', { includeHiddenElements: true });
    expect(rain.props.testID).not.toBe(snow.props.testID);
    expect(getWeatherGlyphKind(61)).toBe('rain');
    expect(getWeatherGlyphKind(71)).toBe('snow');
  });

  it('renders rounded minimum and maximum temperatures beside a shared weekly scale', async () => {
    const { getByText, getByTestId } = await render(<DailyForecast daily={DAILY} />);

    expect(
      getByTestId('daily-min-temperature-0').props.children.join(''),
    ).toBe('Min 18°');
    expect(
      getByTestId('daily-max-temperature-0').props.children.join(''),
    ).toBe('Maks 30°');

    const firstBar = StyleSheet.flatten(
      getByTestId('daily-temperature-bar-0', { includeHiddenElements: true }).props.style,
    );
    const secondBar = StyleSheet.flatten(
      getByTestId('daily-temperature-bar-1', { includeHiddenElements: true }).props.style,
    );
    const firstLowColumn = StyleSheet.flatten(
      getByTestId('daily-min-temperature-0').parent?.props.style,
    );
    const secondLowColumn = StyleSheet.flatten(
      getByTestId('daily-min-temperature-1').parent?.props.style,
    );
    const firstHighColumn = StyleSheet.flatten(
      getByTestId('daily-max-temperature-0').parent?.props.style,
    );
    const secondHighColumn = StyleSheet.flatten(
      getByTestId('daily-max-temperature-1').parent?.props.style,
    );
    expect(parseFloat(firstBar.left)).toBeCloseTo(((18.2 - 15.2) / (33.7 - 15.2)) * 100, 5);
    expect(parseFloat(firstBar.width)).toBeCloseTo(((30.4 - 18.2) / (33.7 - 15.2)) * 100, 5);
    expect(parseFloat(secondBar.left)).toBeGreaterThan(parseFloat(firstBar.left));
    expect(parseFloat(secondBar.width)).toBeLessThan(parseFloat(firstBar.width));
    expect(firstLowColumn.width).toBe('22%');
    expect(secondLowColumn.width).toBe(firstLowColumn.width);
    expect(firstHighColumn.width).toBe('22%');
    expect(secondHighColumn.width).toBe(firstHighColumn.width);
  });

  it('displays negative temperatures accurately', async () => {
    const daily = [withTemperatures(-12.4, -3.2), withTemperatures(-9, -1)];
    const { getByText } = await render(<DailyForecast daily={daily} />);

    expect(getByText('Min -12°')).toBeTruthy();
    expect(getByText('Maks -3°')).toBeTruthy();
    expect(getByText('Min -9°')).toBeTruthy();
    expect(getByText('Maks -1°')).toBeTruthy();
  });

  it('uses a point for every day when the weekly temperatures are all equal', async () => {
    const daily = [withTemperatures(7, 7), withTemperatures(7, 7, '2026-01-02')];
    const { getAllByTestId, queryByTestId } = await render(<DailyForecast daily={daily} />);

    expect(getAllByTestId(/^daily-temperature-point-\d+$/, { includeHiddenElements: true })).toHaveLength(2);
    expect(queryByTestId('daily-temperature-bar-0', { includeHiddenElements: true })).toBeNull();
    expect(queryByTestId('daily-temperature-bar-1', { includeHiddenElements: true })).toBeNull();
  });

  it('uses a point for one zero-width day in a varying week', async () => {
    const daily = [withTemperatures(0, 20), withTemperatures(10, 10, '2026-01-02')];
    const { getByTestId, queryByTestId } = await render(<DailyForecast daily={daily} />);
    const point = StyleSheet.flatten(
      getByTestId('daily-temperature-point-1', { includeHiddenElements: true }).props.style,
    );

    expect(point.left).toBe('50%');
    expect(queryByTestId('daily-temperature-bar-1', { includeHiddenElements: true })).toBeNull();
  });

  it('does not fabricate temperature values or a bar for an invalid daily range', async () => {
    const daily = [
      withTemperatures(Number.NaN, 18),
      withTemperatures(-4, 8, '2026-01-02'),
    ];
    const { getByText, getByTestId, queryByTestId } = await render(<DailyForecast daily={daily} />);

    expect(getByText('Min —')).toBeTruthy();
    expect(getByText('Maks —')).toBeTruthy();
    expect(getByText('Aralık yok')).toBeTruthy();
    expect(queryByTestId('daily-temperature-track-0')).toBeNull();
    expect(getByTestId('daily-temperature-bar-1', { includeHiddenElements: true })).toBeTruthy();
  });

  it('shows actual precipitation probabilities and only positive precipitation amounts', async () => {
    const { getByText, getByTestId, queryByText, queryByTestId } = await render(
      <DailyForecast
        daily={[
          { ...DAILY[0], precipitation: 0, precipitation_probability: 0 },
          { ...DAILY[1], precipitation: 0.001, precipitation_probability: 35 },
          { ...DAILY[2], precipitation: 0, precipitation_probability: 100 },
        ]}
      />,
    );

    expect(getByText('Yağış %0')).toBeTruthy();
    expect(getByText('Yağış %35')).toBeTruthy();
    expect(getByText('Yağış %100')).toBeTruthy();
    expect(queryByTestId('daily-precipitation-amount-0')).toBeNull();
    expect(getByText('<0.01 mm')).toBeTruthy();
    expect(queryByTestId('daily-precipitation-amount-2')).toBeNull();
    expect(queryByText('0 mm')).toBeNull();
  });

  it('keeps 100 percent probability paired with zero millimeters without changing either value', async () => {
    const day = { ...DAILY[0], precipitation: 0, precipitation_probability: 100 };
    const { getByTestId, queryByText } = await render(<DailyForecast daily={[day]} />);

    expect(getByTestId('daily-precipitation-probability-0').props.children.join('')).toBe('Yağış %100');
    expect(queryByText('0 mm')).toBeNull();
    expect(getByTestId('daily-forecast-row-0').props.accessibilityLabel).toContain(
      'yağış olasılığı yüzde 100',
    );
    expect(getByTestId('daily-forecast-row-0').props.accessibilityLabel).not.toContain(
      'yağış miktarı',
    );
  });

  it('groups each row into one complete TalkBack description and hides decorative details', async () => {
    const { getByTestId } = await render(<DailyForecast daily={DAILY} theme={getWeatherTheme(61)} />);
    const row = getByTestId('daily-forecast-row-1');
    const icon = getByTestId('daily-weather-icon-rain-1', { includeHiddenElements: true });
    const range = getByTestId('daily-temperature-track-1', { includeHiddenElements: true });

    expect(row.props.accessibilityRole).toBe('text');
    expect(row.props.accessibilityLabel).toBe(
      'Pazartesi, 31 Ağu; Yağmurlu; en düşük sıcaklık 19 derece; en yüksek sıcaklık 30 derece; yağış olasılığı yüzde 65; yağış miktarı 1.23 milimetre',
    );
    expect(icon.props.accessible).toBe(false);
    expect(icon.props.accessibilityElementsHidden).toBe(true);
    expect(range.props.accessible).toBe(false);
    expect(range.props.accessibilityElementsHidden).toBe(true);
  });

  it('lets the system scale daily text and keeps rainy text readable on light and dark surfaces', async () => {
    const { getByTestId, getByText } = await render(
      <DailyForecast daily={DAILY} theme={getWeatherTheme(61)} />,
    );
    const date = getByTestId('daily-date-0');
    const card = getByTestId('daily-forecast-row-0');

    expect(date.props.allowFontScaling).toBe(true);
    expect(StyleSheet.flatten(card.props.style).backgroundColor).toBe('#112C47');
    expect(StyleSheet.flatten(getByText('7 Günlük Tahmin').props.style).color).toBe('#253849');
    expect(StyleSheet.flatten(date.props.style).color).toBe('#F2F7FC');

    const emptyState = await render(<DailyForecast daily={[]} theme={getWeatherTheme(61)} />);
    expect(
      StyleSheet.flatten(emptyState.getByTestId('daily-forecast-empty-state').props.style).color,
    ).toBe('#526879');
  });

  it('shows a clear empty state for an empty forecast', async () => {
    const { getByText, getByTestId, queryByTestId } = await render(<DailyForecast daily={[]} />);

    expect(getByText('7 Günlük Tahmin')).toBeTruthy();
    expect(getByTestId('daily-forecast-empty-state')).toBeTruthy();
    expect(queryByTestId('daily-forecast-row-0')).toBeNull();
  });
});
