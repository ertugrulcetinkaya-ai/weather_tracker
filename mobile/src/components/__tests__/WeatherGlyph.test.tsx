import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';

import { getWeatherGlyphKind, WeatherGlyph } from '../WeatherGlyph';

describe('WeatherGlyph', () => {
  it('renders rain drops and snowflakes with different accent colors', async () => {
    const { getByTestId } = await render(
      <View>
        <WeatherGlyph kind={getWeatherGlyphKind(61)} isDark={false} palette="daily" testID="rain-glyph" />
        <WeatherGlyph kind={getWeatherGlyphKind(71)} isDark={false} palette="daily" testID="snow-glyph" />
      </View>,
    );

    const rain = getByTestId('rain-glyph', { includeHiddenElements: true });
    const snow = getByTestId('snow-glyph', { includeHiddenElements: true });
    const rainViews = rain.queryAll((instance) => instance.type === 'View', { includeSelf: true });
    const snowViews = snow.queryAll((instance) => instance.type === 'View', { includeSelf: true });
    const rainStyles = getStyles(rainViews);
    const snowStyles = getStyles(snowViews);
    const rainDropViews = rainStyles.filter((style) => hasRotation(style, '18deg'));
    const snowflakeDiagonalViews = snowStyles.filter(
      (style) => hasRotation(style, '60deg') || hasRotation(style, '120deg'),
    );

    expect(rainDropViews).toHaveLength(3);
    expect(snowflakeDiagonalViews).toHaveLength(4);
    expect(rainStyles.map((style) => style.backgroundColor)).toContain('#2478AA');
    expect(snowStyles.map((style) => style.backgroundColor)).toContain('#008F81');
    expect(getWeatherGlyphKind(66)).toBe('rain');
    expect(getWeatherGlyphKind(67)).toBe('rain');
  });

  it('preserves the original hourly palette', async () => {
    const { getByTestId } = await render(
      <View>
        <WeatherGlyph kind={getWeatherGlyphKind(61)} isDark={false} testID="hourly-rain-glyph" />
        <WeatherGlyph kind={getWeatherGlyphKind(71)} isDark={false} testID="hourly-snow-glyph" />
      </View>,
    );
    const rainStyles = getStyles(
      getByTestId('hourly-rain-glyph', { includeHiddenElements: true }).queryAll(
        (instance) => instance.type === 'View',
        { includeSelf: true },
      ),
    );
    const snowStyles = getStyles(
      getByTestId('hourly-snow-glyph', { includeHiddenElements: true }).queryAll(
        (instance) => instance.type === 'View',
        { includeSelf: true },
      ),
    );

    expect(rainStyles.map((style) => style.backgroundColor)).toContain('#397F9F');
    expect(snowStyles.map((style) => style.backgroundColor)).toContain('#348DB7');
  });

  it('uses the existing hourly glyph test IDs when reused by the chart', async () => {
    const { getByTestId } = await render(
      <WeatherGlyph
        kind={getWeatherGlyphKind(71)}
        isDark
        testID="hourly-weather-icon-snow-0"
      />,
    );

    expect(getByTestId('hourly-weather-icon-snow-0', { includeHiddenElements: true })).toBeTruthy();
  });
});

function getStyles(instances: TestInstance[]): ViewStyle[] {
  return instances
    .map((instance) => StyleSheet.flatten(instance.props.style) as ViewStyle | undefined)
    .filter((style): style is ViewStyle => style !== undefined);
}

function hasRotation(style: ViewStyle, rotation: string): boolean {
  if (!Array.isArray(style.transform)) return false;
  return (style.transform as ReadonlyArray<{ rotate?: string }>).some(
    (transform) => transform.rotate === rotation,
  );
}
