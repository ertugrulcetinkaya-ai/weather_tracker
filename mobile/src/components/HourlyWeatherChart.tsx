import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { HourlyWeather } from '../types/weather';
import { getWeatherCondition } from '../weather/condition';
import { formatPrecipitation } from '../weather/format';
import type { WeatherTheme } from '../weather/theme';
import { getWeatherGlyphKind, WeatherGlyph } from './WeatherGlyph';

const COLUMN_WIDTH = 84;
const GRAPH_TOP = 82;
const GRAPH_BOTTOM = 128;
const TEMPERATURE_LABEL_HEIGHT = 24;
const RAIN_BAR_TOP = 166;
const RAIN_BASELINE = 194;
const MAX_RAIN_BAR_HEIGHT = RAIN_BASELINE - RAIN_BAR_TOP;
const TRACK_HEIGHT = 222;
const DOT_SIZE = 8;

export type HourlyChartPalette = {
  temperatureLine: string;
  precipitationBar: string;
};

type HourlyWeatherChartProps = {
  hourly: HourlyWeather[];
  theme: WeatherTheme;
  rainStartIndex: number;
  rainStartTime: string | null;
  rainStartInterval: string | null;
};

export function getHourlyChartPalette(theme: WeatherTheme): HourlyChartPalette {
  return theme.kind === 'rainy'
    ? { temperatureLine: '#73CCFF', precipitationBar: '#83BDE0' }
    : { temperatureLine: '#2B7FA2', precipitationBar: '#4B8BA8' };
}

/** Linear positions for every record, without smoothing or moving sample points. */
export function calculateTemperaturePointYValues(temperatures: number[]): number[] {
  if (temperatures.length === 0) return [];

  const minimum = Math.min(...temperatures);
  const maximum = Math.max(...temperatures);
  const middle = (GRAPH_TOP + GRAPH_BOTTOM) / 2;

  if (minimum === maximum) {
    return temperatures.map(() => middle);
  }

  return temperatures.map((temperature) => {
    const proportion = (temperature - minimum) / (maximum - minimum);
    return GRAPH_BOTTOM - proportion * (GRAPH_BOTTOM - GRAPH_TOP);
  });
}

function formatHour(time: string): string {
  const match = /(?:T|^)(\d{2}):(\d{2})/.exec(time);
  return match ? `${match[1]}:${match[2]}` : time;
}

function shiftWallClockHour(time: string, hourOffset: number): string | null {
  const wallClockTime = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/.exec(time)?.[1];
  if (!wallClockTime) return null;

  const timestamp = Date.parse(`${wallClockTime}:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + hourOffset * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function formatTemperature(value: number): string {
  const rounded = Math.round(value);
  return `${Object.is(rounded, -0) ? 0 : rounded}°`;
}

function getRainBarHeight(precipitation: number, maximum: number): number {
  if (precipitation <= 0 || maximum <= 0) return 0;
  return Math.max(2, (precipitation / maximum) * MAX_RAIN_BAR_HEIGHT);
}

function LineSegment({
  x1,
  y1,
  x2,
  y2,
  color,
  index,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  index: number;
}) {
  const width = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);

  return (
    <View
      testID={`hourly-temperature-segment-${index}`}
      accessible={false}
      pointerEvents="none"
      style={[
        styles.temperatureSegment,
        {
          left: (x1 + x2) / 2 - width / 2,
          top: (y1 + y2) / 2 - 1,
          width,
          backgroundColor: color,
          transform: [{ rotate: `${angle}rad` }],
        },
      ]}
    />
  );
}

export function HourlyWeatherChart({
  hourly,
  theme,
  rainStartIndex,
  rainStartTime,
  rainStartInterval,
}: HourlyWeatherChartProps) {
  const palette = getHourlyChartPalette(theme);
  const yValues = calculateTemperaturePointYValues(hourly.map((hour) => hour.temperature));
  const maximumPrecipitation = Math.max(0, ...hourly.map((hour) => hour.precipitation));
  const isDark = theme.kind === 'rainy';
  const trackWidth = hourly.length * COLUMN_WIDTH;

  return (
    <ScrollView
      testID="hourly-forecast-scroll"
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View
        testID="hourly-chart-track"
        style={[styles.track, { width: trackWidth, height: TRACK_HEIGHT }]}
      >
        <View
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.temperatureLineLayer, { width: trackWidth, height: TRACK_HEIGHT }]}
        >
          {hourly.slice(0, -1).map((_, index) => (
            <LineSegment
              key={`temperature-segment-${index}`}
              index={index}
              x1={(index + 0.5) * COLUMN_WIDTH}
              y1={yValues[index]}
              x2={(index + 1.5) * COLUMN_WIDTH}
              y2={yValues[index + 1]}
              color={palette.temperatureLine}
            />
          ))}
          {hourly.map((_, index) => (
            <View
              key={`temperature-point-${index}`}
              testID={`hourly-temperature-point-${index}`}
              accessible={false}
              style={[
                styles.temperaturePoint,
                {
                  left: (index + 0.5) * COLUMN_WIDTH - DOT_SIZE / 2,
                  top: yValues[index] - DOT_SIZE / 2,
                  backgroundColor: palette.temperatureLine,
                  borderColor: theme.surface,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.hourColumns}>
          {hourly.map((hour, index) => {
            const glyphKind = getWeatherGlyphKind(hour.weather_code);
            const condition = getWeatherCondition(hour.weather_code);
            const previousHour = shiftWallClockHour(hour.time, -1);
            const precipitationInterval =
              `${formatHour(previousHour ?? hour.time)}–${formatHour(hour.time)}`;
            const isRainStart = index === rainStartIndex && hour.precipitation > 0;
            const rainStartDescription =
              isRainStart && rainStartTime !== null && rainStartInterval !== null
                ? `Yağış başlar ${formatHour(rainStartTime)}; ilk yağış aralığı ${rainStartInterval}`
                : '';
            const accessibilityLabel = [
              rainStartDescription,
              `Saat ${formatHour(hour.time)}`,
              `sıcaklık ${formatTemperature(hour.temperature).replace('°', '')} derece`,
              `hava durumu: ${condition.label}`,
              `yağış olasılığı %${hour.precipitation_probability}`,
              `${precipitationInterval} aralığında yağış miktarı ${formatPrecipitation(hour.precipitation)} mm`,
            ]
              .filter(Boolean)
              .join('; ');
            const rainBarHeight = getRainBarHeight(
              hour.precipitation,
              maximumPrecipitation,
            );

            return (
              <View
                key={`${hour.time}-${index}`}
                testID={`hourly-cell-${index}`}
                accessible
                accessibilityRole="text"
                accessibilityLabel={accessibilityLabel}
                importantForAccessibility="yes"
                style={[styles.hourColumn, { width: COLUMN_WIDTH, height: TRACK_HEIGHT }]}
              >
                <Text
                  accessible={false}
                  importantForAccessibility="no"
                  allowFontScaling
                  testID={`hourly-time-${index}`}
                  style={[styles.hourLabel, { color: theme.text }]}
                >
                  {formatHour(hour.time)}
                </Text>

                <View style={styles.iconPosition}>
                  <WeatherGlyph
                    kind={glyphKind}
                    isDark={isDark}
                    testID={`hourly-weather-icon-${glyphKind}-${index}`}
                  />
                </View>

                <Text
                  accessible={false}
                  importantForAccessibility="no"
                  allowFontScaling
                  testID={`hourly-temperature-label-${index}`}
                  style={[
                    styles.temperatureLabel,
                    {
                      top: yValues[index] - TEMPERATURE_LABEL_HEIGHT - 4,
                      color: theme.text,
                    },
                  ]}
                >
                  {formatTemperature(hour.temperature)}
                </Text>

                <View
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                  style={[styles.probabilityPill, { backgroundColor: theme.accentSoft }]}
                >
                  <Text allowFontScaling style={[styles.probabilityText, { color: theme.text }]}>
                    {`${hour.precipitation_probability}%`}
                  </Text>
                </View>

                <View
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.rainMeter,
                    {
                      left: (COLUMN_WIDTH - 28) / 2,
                      top: RAIN_BAR_TOP,
                      height: RAIN_BASELINE - RAIN_BAR_TOP + 1,
                    },
                  ]}
                >
                  {rainBarHeight > 0 && (
                    <View
                      testID={isRainStart ? 'rain-start-bar' : undefined}
                      style={[
                        styles.rainBar,
                        {
                          height: rainBarHeight,
                          backgroundColor: palette.precipitationBar,
                          borderColor: isRainStart
                            ? (isDark ? '#D7F2FF' : '#174E68')
                            : palette.precipitationBar,
                          borderWidth: isRainStart ? 2 : 0,
                        },
                      ]}
                    />
                  )}
                </View>

                {isRainStart && rainBarHeight > 0 && (
                  <View
                    testID="rain-start-marker"
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                    pointerEvents="none"
                    style={[
                      styles.rainStartTriangle,
                      {
                        left: (COLUMN_WIDTH - 10) / 2,
                        top: RAIN_BASELINE - rainBarHeight - 6,
                        borderBottomColor: isDark ? '#D7F2FF' : '#174E68',
                      },
                    ]}
                  />
                )}

                <Text
                  accessible={false}
                  importantForAccessibility="no"
                  allowFontScaling
                  testID={`hourly-precipitation-amount-${index}`}
                  style={[styles.precipitationAmount, { color: theme.text }]}
                >
                  {formatPrecipitation(hour.precipitation)}
                </Text>
              </View>
            );
          })}
        </View>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[
            styles.rainBaseline,
            {
              left: 0,
              top: RAIN_BASELINE,
              width: trackWidth,
              backgroundColor: theme.surfaceBorder,
            },
          ]}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, width: '100%' },
  scrollContent: { paddingHorizontal: 10 },
  track: { position: 'relative', flexDirection: 'row' },
  hourColumns: { position: 'absolute', left: 0, top: 0, flexDirection: 'row' },
  hourColumn: {
    position: 'relative',
    alignItems: 'center',
    flexShrink: 0,
  },
  hourLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: COLUMN_WIDTH,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  iconPosition: {
    position: 'absolute',
    top: 21,
    width: COLUMN_WIDTH,
    alignItems: 'center',
  },
  temperatureLineLayer: { position: 'absolute', left: 0, top: 0 },
  temperatureSegment: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    zIndex: 1,
  },
  temperaturePoint: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderWidth: 2,
    borderRadius: DOT_SIZE / 2,
    zIndex: 2,
  },
  temperatureLabel: {
    position: 'absolute',
    left: 0,
    width: COLUMN_WIDTH,
    height: TEMPERATURE_LABEL_HEIGHT,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    zIndex: 3,
  },
  probabilityPill: {
    position: 'absolute',
    top: 134,
    left: (COLUMN_WIDTH - 52) / 2,
    minWidth: 52,
    minHeight: 22,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  probabilityText: { fontSize: 13, fontWeight: '600' },
  rainMeter: {
    position: 'absolute',
    width: 28,
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#7A8E9C',
  },
  rainBar: { width: 10, borderRadius: 6 },
  rainStartTriangle: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  rainBaseline: { position: 'absolute', height: StyleSheet.hairlineWidth },
  precipitationAmount: {
    position: 'absolute',
    top: 198,
    left: 0,
    width: COLUMN_WIDTH,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
});
