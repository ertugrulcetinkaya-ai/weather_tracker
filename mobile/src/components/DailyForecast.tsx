import { StyleSheet, Text, View } from 'react-native';

import type { DailyWeather } from '../types/weather';
import {
  calculateDailyTemperatureBar,
  getDailyTemperatureScale,
  isValidDailyTemperatureRange,
} from '../weather/dailyTemperatureScale';
import { getWeatherCondition } from '../weather/condition';
import { formatPrecipitation } from '../weather/format';
import { getWeatherTheme } from '../weather/theme';
import type { WeatherTheme } from '../weather/theme';
import { getWeatherGlyphKind, WeatherGlyph } from './WeatherGlyph';

const DAILY_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAY_LABELS = [
  'Pazar',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
];
const MONTH_LABELS = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
];

type DailyForecastProps = {
  daily: DailyWeather[];
  theme?: WeatherTheme;
};

// Use the provider's calendar date without inheriting the device timezone.
// Round-trip validation prevents JavaScript from normalizing dates such as
// February 30 into a different month.
function formatDayLabel(date: string): string {
  const match = DAILY_DATE_PATTERN.exec(date);
  if (!match) return date;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return date;

  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return date;
  }

  const weekday = WEEKDAY_LABELS[parsed.getUTCDay()];
  const monthLabel = MONTH_LABELS[month - 1];
  if (!weekday || !monthLabel) return date;
  return `${weekday}, ${day} ${monthLabel}`;
}

function formatTemperature(value: number): string {
  const rounded = Math.round(value);
  return `${Object.is(rounded, -0) ? 0 : rounded}°`;
}

function hasPositivePrecipitation(day: DailyWeather): boolean {
  return Number.isFinite(day.precipitation) && day.precipitation > 0;
}

function TemperatureRangeBar({
  index,
  bar,
  theme,
}: {
  index: number;
  bar: ReturnType<typeof calculateDailyTemperatureBar>;
  theme: WeatherTheme;
}) {
  return (
    <View
      testID={`daily-temperature-track-${index}`}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.temperatureTrack,
        { backgroundColor: theme.kind === 'rainy' ? '#40576B' : '#DDE7ED' },
      ]}
    >
      {bar !== null && (bar.isPoint || bar.width === 0 ? (
        <View
          testID={`daily-temperature-point-${index}`}
          style={[
            styles.temperaturePoint,
            { left: `${bar.left}%`, backgroundColor: theme.accent },
          ]}
        />
      ) : (
        <View
          testID={`daily-temperature-bar-${index}`}
          style={[
            styles.temperatureRange,
            {
              left: `${bar.left}%`,
              width: `${bar.width}%`,
              backgroundColor: theme.accent,
            },
          ]}
        />
      ))}
    </View>
  );
}

function buildAccessibilityLabel(
  dayLabel: string,
  conditionLabel: string,
  temperaturesAreValid: boolean,
  day: DailyWeather,
): string {
  const minimum = temperaturesAreValid
    ? `${formatTemperature(day.temperature_min).replace('°', '')} derece`
    : 'bilinmiyor';
  const maximum = temperaturesAreValid
    ? `${formatTemperature(day.temperature_max).replace('°', '')} derece`
    : 'bilinmiyor';
  const precipitationAmount = hasPositivePrecipitation(day)
    ? `; yağış miktarı ${formatPrecipitation(day.precipitation)} milimetre`
    : '';

  return `${dayLabel}; ${conditionLabel}; en düşük sıcaklık ${minimum}; en yüksek sıcaklık ${maximum}; yağış olasılığı yüzde ${day.precipitation_probability}${precipitationAmount}`;
}

export function DailyForecast({ daily, theme }: DailyForecastProps) {
  const resolvedTheme = theme ?? getWeatherTheme(daily[0]?.weather_code);
  // The forecast section sits on a white surface even when rainy cards are dark.
  const titleColor = resolvedTheme.kind === 'rainy' ? '#253849' : resolvedTheme.text;
  const emptyStateColor = resolvedTheme.kind === 'rainy' ? '#526879' : resolvedTheme.mutedText;
  const temperatureScale = getDailyTemperatureScale(daily);

  return (
    <View style={styles.section}>
      <Text
        allowFontScaling
        style={[styles.dailyTitle, { color: titleColor }]}
      >
        7 Günlük Tahmin
      </Text>
      {daily.length === 0 ? (
        <Text
          allowFontScaling
          testID="daily-forecast-empty-state"
          style={[styles.emptyState, { color: emptyStateColor }]}
        >
          7 günlük tahmin bulunmuyor.
        </Text>
      ) : (
        <View style={styles.dailyList}>
          {daily.map((day, index) => {
            const condition = getWeatherCondition(day.weather_code);
            const glyphKind = getWeatherGlyphKind(day.weather_code);
            const dayLabel = formatDayLabel(day.date);
            const temperaturesAreValid = isValidDailyTemperatureRange(day);
            const temperatureBar = calculateDailyTemperatureBar(day, temperatureScale);
            const accessibilityLabel = buildAccessibilityLabel(
              dayLabel,
              condition.label,
              temperaturesAreValid,
              day,
            );

            return (
              <View
                key={`${day.date}-${index}`}
                testID={`daily-forecast-row-${index}`}
                accessible
                accessibilityRole="text"
                accessibilityLabel={accessibilityLabel}
                importantForAccessibility="yes"
                style={[
                  styles.dailyCard,
                  {
                    backgroundColor: resolvedTheme.surface,
                    borderColor: resolvedTheme.surfaceBorder,
                  },
                ]}
              >
                <View style={styles.dailyTopRow}>
                  <View style={styles.dayDescription}>
                    <WeatherGlyph
                      kind={glyphKind}
                      isDark={resolvedTheme.kind === 'rainy'}
                      palette="daily"
                      testID={`daily-weather-icon-${glyphKind}-${index}`}
                    />
                    <View style={styles.dayText}>
                      <Text
                        allowFontScaling
                        accessible={false}
                        importantForAccessibility="no"
                        testID={`daily-date-${index}`}
                        style={[styles.dailyDate, { color: resolvedTheme.text }]}
                      >
                        {dayLabel}
                      </Text>
                      <Text
                        allowFontScaling
                        accessible={false}
                        importantForAccessibility="no"
                        style={[styles.dailyCondition, { color: resolvedTheme.mutedText }]}
                      >
                        {condition.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.precipitationInfo}>
                    <Text
                      allowFontScaling
                      accessible={false}
                      importantForAccessibility="no"
                      testID={`daily-precipitation-probability-${index}`}
                      style={[styles.dailyProbability, { color: resolvedTheme.accent }]}
                    >
                      Yağış %{day.precipitation_probability}
                    </Text>
                    {hasPositivePrecipitation(day) ? (
                      <Text
                        allowFontScaling
                        accessible={false}
                        importantForAccessibility="no"
                        testID={`daily-precipitation-amount-${index}`}
                        style={[styles.dailyPrecipitation, { color: resolvedTheme.mutedText }]}
                      >
                        {formatPrecipitation(day.precipitation)} mm
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.temperatureRow}>
                  <View style={styles.temperatureLabelColumn}>
                    <Text
                      allowFontScaling
                      accessible={false}
                      importantForAccessibility="no"
                      testID={`daily-min-temperature-${index}`}
                      style={[styles.temperatureValue, { color: resolvedTheme.mutedText }]}
                    >
                      Min {temperaturesAreValid ? formatTemperature(day.temperature_min) : '—'}
                    </Text>
                  </View>
                  {temperaturesAreValid ? (
                    <TemperatureRangeBar index={index} bar={temperatureBar} theme={resolvedTheme} />
                  ) : (
                    <Text
                      allowFontScaling
                      accessible={false}
                      importantForAccessibility="no"
                      style={[styles.invalidTemperature, { color: resolvedTheme.mutedText }]}
                    >
                      Aralık yok
                    </Text>
                  )}
                  <View style={[styles.temperatureLabelColumn, styles.maximumTemperatureColumn]}>
                    <Text
                      allowFontScaling
                      accessible={false}
                      importantForAccessibility="no"
                      testID={`daily-max-temperature-${index}`}
                      style={[styles.temperatureValue, { color: resolvedTheme.text }]}
                    >
                      Maks {temperaturesAreValid ? formatTemperature(day.temperature_max) : '—'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%' },
  dailyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  dailyList: {
    width: '100%',
    gap: 8,
  },
  dailyCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  dailyTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
    rowGap: 4,
  },
  dayDescription: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayText: { flex: 1, minWidth: 0 },
  dailyDate: { fontSize: 14, fontWeight: '600' },
  dailyCondition: { fontSize: 12, lineHeight: 17 },
  precipitationInfo: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  dailyProbability: { fontSize: 12, fontWeight: '600' },
  dailyPrecipitation: { fontSize: 12, lineHeight: 17 },
  temperatureRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  temperatureLabelColumn: {
    width: '22%',
    minWidth: 0,
  },
  maximumTemperatureColumn: { alignItems: 'flex-end' },
  temperatureValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  temperatureTrack: {
    position: 'relative',
    flex: 1,
    minWidth: 24,
    height: 6,
    borderRadius: 4,
  },
  temperatureRange: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  temperaturePoint: {
    position: 'absolute',
    top: -1,
    width: 8,
    height: 8,
    marginLeft: -4,
    borderRadius: 4,
  },
  invalidTemperature: { flex: 1, fontSize: 12, textAlign: 'center' },
  emptyState: { fontSize: 14, lineHeight: 20, paddingVertical: 14 },
});
