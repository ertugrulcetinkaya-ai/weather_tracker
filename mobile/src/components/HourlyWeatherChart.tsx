import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import type { HourlyWeather } from '../types/weather';
import { getWeatherCondition } from '../weather/condition';
import { formatPrecipitation } from '../weather/format';
import type { WeatherTheme } from '../weather/theme';

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

type WeatherGlyphKind = 'sunny' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm' | 'neutral';

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

function getWeatherGlyphKind(code: number): WeatherGlyphKind {
  if (code === 0 || code === 1) return 'sunny';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'neutral';
}

function getWeatherGlyphColors(kind: WeatherGlyphKind, isDark: boolean) {
  if (kind === 'sunny') {
    return { cloud: isDark ? '#DDE8F0' : '#8EA3B2', accent: isDark ? '#FFD478' : '#B8770A' };
  }
  if (kind === 'snow') {
    return { cloud: isDark ? '#DDE8F0' : '#9CB2C0', accent: isDark ? '#9DE7FF' : '#348DB7' };
  }
  if (kind === 'rain' || kind === 'storm') {
    return { cloud: isDark ? '#CAD9E5' : '#8198A9', accent: isDark ? '#8DD6FF' : '#397F9F' };
  }
  return { cloud: isDark ? '#DDE8F0' : '#879CAB', accent: isDark ? '#B9D9E9' : '#526F82' };
}

function WeatherGlyph({
  kind,
  index,
  isDark,
}: {
  kind: WeatherGlyphKind;
  index: number;
  isDark: boolean;
}) {
  const { cloud, accent } = getWeatherGlyphColors(kind, isDark);

  return (
    <View
      testID={`hourly-weather-icon-${kind}-${index}`}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.weatherGlyph}
    >
      {kind === 'sunny' ? (
        <View style={styles.sunGlyph}>
          <View style={[styles.sunRay, styles.sunRayTop, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayTopRight, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayRight, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayBottomRight, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayBottom, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayBottomLeft, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayLeft, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayTopLeft, { backgroundColor: accent }]} />
          <View style={[styles.sunDisk, { backgroundColor: accent }]} />
        </View>
      ) : kind === 'neutral' ? (
        <View style={[styles.neutralGlyph, { borderColor: accent }]}>
          <View style={[styles.neutralDot, { backgroundColor: accent }]} />
          <View style={[styles.neutralDot, { backgroundColor: accent }]} />
          <View style={[styles.neutralDot, { backgroundColor: accent }]} />
        </View>
      ) : (
        <View style={styles.cloudGlyph}>
          <View
            style={[
              styles.cloudPuff,
              { left: 5, top: 7, width: 16, height: 16, backgroundColor: cloud },
            ]}
          />
          <View
            style={[
              styles.cloudPuff,
              { left: 13, top: 2, width: 19, height: 19, backgroundColor: cloud },
            ]}
          />
          <View style={[styles.cloudBase, { backgroundColor: cloud }]} />
          {kind === 'rain' && (
            <>
              <View style={[styles.raindrop, { left: 8, backgroundColor: accent }]} />
              <View style={[styles.raindrop, { left: 16, backgroundColor: accent }]} />
              <View style={[styles.raindrop, { left: 24, backgroundColor: accent }]} />
            </>
          )}
          {kind === 'snow' && (
            <>
              <Snowflake style={styles.snowflakeLeft} color={accent} />
              <Snowflake style={styles.snowflakeRight} color={accent} />
            </>
          )}
          {kind === 'fog' && (
            <>
              <View style={[styles.fogLine, styles.fogLineTop, { backgroundColor: accent }]} />
              <View style={[styles.fogLine, styles.fogLineBottom, { backgroundColor: accent }]} />
            </>
          )}
          {kind === 'storm' && (
            <View style={styles.lightning}>
              <View style={[styles.lightningArm, styles.lightningArmTop]} />
              <View style={[styles.lightningArm, styles.lightningArmBottom]} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Snowflake({ color, style }: { color: string; style: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.snowflake, style]}>
      <View style={[styles.snowflakeArm, { backgroundColor: color }]} />
      <View
        style={[
          styles.snowflakeArm,
          styles.snowflakeArmDiagonalOne,
          { backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.snowflakeArm,
          styles.snowflakeArmDiagonalTwo,
          { backgroundColor: color },
        ]}
      />
    </View>
  );
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
                  <WeatherGlyph kind={glyphKind} index={index} isDark={isDark} />
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
  weatherGlyph: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center' },
  sunGlyph: { position: 'relative', width: 28, height: 28 },
  sunRay: { position: 'absolute', width: 2, height: 5, borderRadius: 2 },
  sunRayTop: { top: 0, left: 13 },
  sunRayTopRight: { top: 3, left: 22, transform: [{ rotate: '45deg' }] },
  sunRayRight: { top: 12, left: 24, transform: [{ rotate: '90deg' }] },
  sunRayBottomRight: { top: 20, left: 22, transform: [{ rotate: '135deg' }] },
  sunRayBottom: { top: 23, left: 13 },
  sunRayBottomLeft: { top: 20, left: 4, transform: [{ rotate: '45deg' }] },
  sunRayLeft: { top: 12, left: 2, transform: [{ rotate: '90deg' }] },
  sunRayTopLeft: { top: 3, left: 4, transform: [{ rotate: '135deg' }] },
  sunDisk: { position: 'absolute', top: 7, left: 7, width: 14, height: 14, borderRadius: 7 },
  cloudGlyph: { position: 'relative', width: 34, height: 32 },
  cloudPuff: { position: 'absolute', borderRadius: 12 },
  cloudBase: {
    position: 'absolute',
    left: 3,
    top: 12,
    width: 29,
    height: 10,
    borderRadius: 6,
  },
  raindrop: {
    position: 'absolute',
    top: 21,
    width: 3,
    height: 7,
    borderRadius: 3,
    transform: [{ rotate: '18deg' }],
  },
  snowflake: { position: 'absolute', top: 19, width: 13, height: 13 },
  snowflakeLeft: { left: 4 },
  snowflakeRight: { left: 19 },
  snowflakeArm: {
    position: 'absolute',
    top: 0,
    left: 6,
    width: 1.5,
    height: 13,
    borderRadius: 1,
  },
  snowflakeArmDiagonalOne: { transform: [{ rotate: '60deg' }] },
  snowflakeArmDiagonalTwo: { transform: [{ rotate: '120deg' }] },
  fogLine: { position: 'absolute', height: 1.5, borderRadius: 1 },
  fogLineTop: { top: 23, left: 4, width: 14 },
  fogLineBottom: { top: 27, left: 14, width: 15 },
  lightning: { position: 'absolute', top: 17, left: 13, width: 9, height: 14 },
  lightningArm: {
    position: 'absolute',
    left: 3,
    width: 3,
    height: 9,
    backgroundColor: '#F3B941',
    borderRadius: 1,
  },
  lightningArmTop: { top: 0, transform: [{ rotate: '25deg' }] },
  lightningArmBottom: { top: 6, left: 1, transform: [{ rotate: '-25deg' }] },
  neutralGlyph: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  neutralDot: { width: 2, height: 2, borderRadius: 1 },
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
