import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import type { CurrentWeather } from '../types/weather';
import { formatWeatherTime, getWeatherCondition } from '../weather/condition';
import { formatWindSpeed } from '../weather/format';
import { getWeatherTheme } from '../weather/theme';

type CurrentWeatherCardProps = {
  current: CurrentWeather;
  fetchedAt?: number | null;
};

function formatLastUpdated(fetchedAt: number): string {
  const time = new Date(fetchedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `Güncellendi · ${time}`;
}

function WeatherArtwork({ weatherCode }: { weatherCode: number }) {
  const theme = getWeatherTheme(weatherCode);
  const isRainy = theme.kind === 'rainy';
  const isSnowy = theme.kind === 'snowy';

  return (
    <View
      testID={`weather-artwork-${theme.kind}`}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.artwork, { backgroundColor: theme.accentSoft }]}
    >
      {theme.kind === 'sunny' && (
        <View style={styles.sunAssembly}>
          <View style={[styles.sunRay, styles.sunRayTop, { backgroundColor: theme.accent }]} />
          <View style={[styles.sunRay, styles.sunRayRight, { backgroundColor: theme.accent }]} />
          <View style={[styles.sunRay, styles.sunRayBottom, { backgroundColor: theme.accent }]} />
          <View style={[styles.sunRay, styles.sunRayLeft, { backgroundColor: theme.accent }]} />
          <View style={[styles.sunRay, styles.sunRayTopRight, { backgroundColor: theme.accent }]} />
          <View style={[styles.sunRay, styles.sunRayBottomRight, { backgroundColor: theme.accent }]} />
          <View style={[styles.sunRay, styles.sunRayBottomLeft, { backgroundColor: theme.accent }]} />
          <View style={[styles.sunRay, styles.sunRayTopLeft, { backgroundColor: theme.accent }]} />
          <View style={[styles.sunDisk, { backgroundColor: theme.accent }]} />
        </View>
      )}

      {(theme.kind === 'cloudy' || isRainy || isSnowy || theme.kind === 'neutral') && (
        <View style={styles.cloudAssembly}>
          <View style={[
            styles.cloudPuff,
            styles.cloudPuffBack,
            { backgroundColor: isRainy ? '#8DA7B8' : '#FFFFFF' },
          ]} />
          <View style={[
            styles.cloudPuff,
            styles.cloudPuffFront,
            { backgroundColor: isRainy ? '#8DA7B8' : '#FFFFFF' },
          ]} />
          <View style={[
            styles.cloudBase,
            {
              backgroundColor: isRainy ? '#8DA7B8' : '#FFFFFF',
              borderColor: theme.accent,
            },
          ]} />
          {isRainy && [0, 1, 2].map((drop) => (
            <View
              key={`drop-${drop}`}
              style={[
                styles.raindrop,
                { left: 25 + drop * 16, backgroundColor: theme.decoration },
              ]}
            />
          ))}
          {isSnowy && (
            <>
              <SnowMark style={styles.snowMarkLeft} color={theme.accent} />
              <SnowMark style={styles.snowMarkCenter} color={theme.accent} />
              <SnowMark style={styles.snowMarkRight} color={theme.accent} />
            </>
          )}
        </View>
      )}
    </View>
  );
}

function SnowMark({ color, style }: { color: string; style: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.snowMark, style]}>
      <View style={[styles.snowMarkArm, { backgroundColor: color }]} />
      <View style={[styles.snowMarkArm, styles.snowMarkDiagonalOne, { backgroundColor: color }]} />
      <View style={[styles.snowMarkArm, styles.snowMarkDiagonalTwo, { backgroundColor: color }]} />
    </View>
  );
}

export function CurrentWeatherCard({ current, fetchedAt }: CurrentWeatherCardProps) {
  const theme = getWeatherTheme(current.weather_code);
  const condition = getWeatherCondition(current.weather_code);
  const roundedTemperature = Math.round(current.temperature);
  const humidity = String(current.humidity);
  const windSpeed = formatWindSpeed(current.wind_speed);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.heroSurface,
          borderColor: theme.surfaceBorder,
        },
      ]}
    >
      <Text style={[styles.location, { color: theme.text }]}>{current.location}</Text>

      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <Text
            accessibilityLabel={`${roundedTemperature} derece`}
            style={[styles.temperature, { color: theme.text }]}
          >
            {roundedTemperature}°
          </Text>
          <Text style={[styles.condition, { color: theme.text }]}>{condition.label}</Text>
          <Text style={[styles.apparent, { color: theme.mutedText }]}>
            Hissedilen {Math.round(current.apparent_temperature)}°
          </Text>
        </View>
        <WeatherArtwork weatherCode={current.weather_code} />
      </View>

      <View style={styles.timeDetails}>
        <Text style={[styles.weatherTime, { color: theme.mutedText }]}>
          {formatWeatherTime(current.time)}
        </Text>
        {fetchedAt !== null && fetchedAt !== undefined && (
          <Text style={[styles.lastUpdated, { color: theme.mutedText }]}>
            {formatLastUpdated(fetchedAt)}
          </Text>
        )}
      </View>

      <View style={[styles.metricTray, { backgroundColor: theme.accentSoft }]}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Nem</Text>
          <Text
            accessibilityLabel={`yüzde ${humidity}`}
            style={[styles.metricValue, { color: theme.text }]}
          >
            %{humidity}
          </Text>
        </View>
        <View style={[styles.metricDivider, { backgroundColor: theme.surfaceBorder }]} />
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: theme.mutedText }]}>Rüzgâr</Text>
          <Text
            accessibilityLabel={`${windSpeed} kilometre bölü saat`}
            style={[styles.metricValue, { color: theme.text }]}
          >
            {windSpeed} km/h
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#18364A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  location: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  temperature: {
    fontSize: 66,
    fontWeight: '300',
    includeFontPadding: false,
    flexShrink: 1,
  },
  condition: {
    fontSize: 18,
    fontWeight: '600',
    flexShrink: 1,
  },
  apparent: {
    fontSize: 14,
    marginTop: 4,
    flexShrink: 1,
  },
  artwork: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    overflow: 'hidden',
  },
  sunAssembly: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunDisk: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  sunRay: {
    position: 'absolute',
    width: 3,
    height: 10,
    borderRadius: 2,
  },
  sunRayTop: { top: 0, left: 30 },
  sunRayRight: { right: 0, top: 27, transform: [{ rotate: '90deg' }] },
  sunRayBottom: { bottom: 0, left: 30 },
  sunRayLeft: { left: 0, top: 27, transform: [{ rotate: '90deg' }] },
  sunRayTopRight: { right: 8, top: 8, transform: [{ rotate: '45deg' }] },
  sunRayBottomRight: { right: 8, bottom: 8, transform: [{ rotate: '-45deg' }] },
  sunRayBottomLeft: { left: 8, bottom: 8, transform: [{ rotate: '45deg' }] },
  sunRayTopLeft: { left: 8, top: 8, transform: [{ rotate: '-45deg' }] },
  cloudAssembly: {
    width: 68,
    height: 66,
    alignItems: 'center',
  },
  cloudPuff: {
    position: 'absolute',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#8EAAB9',
  },
  cloudPuffBack: {
    width: 38,
    height: 38,
    top: 8,
    left: 13,
  },
  cloudPuffFront: {
    width: 30,
    height: 30,
    top: 15,
    right: 4,
  },
  cloudBase: {
    position: 'absolute',
    left: 3,
    top: 29,
    width: 64,
    height: 23,
    borderRadius: 16,
    borderWidth: 1,
  },
  raindrop: {
    position: 'absolute',
    top: 54,
    width: 5,
    height: 12,
    borderRadius: 4,
  },
  snowMark: {
    position: 'absolute',
    width: 12,
    height: 12,
    top: 53,
  },
  snowMarkLeft: { left: 10 },
  snowMarkCenter: { left: 28 },
  snowMarkRight: { left: 46 },
  snowMarkArm: {
    position: 'absolute',
    width: 2,
    height: 12,
    left: 5,
    top: 0,
    borderRadius: 2,
  },
  snowMarkDiagonalOne: { transform: [{ rotate: '60deg' }] },
  snowMarkDiagonalTwo: { transform: [{ rotate: '-60deg' }] },
  timeDetails: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  weatherTime: {
    fontSize: 12,
    flexShrink: 1,
  },
  lastUpdated: {
    fontSize: 12,
    flexShrink: 1,
    textAlign: 'right',
  },
  metricTray: {
    marginTop: 10,
    borderRadius: 16,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  metricDivider: {
    width: 1,
    height: 34,
  },
  metricLabel: {
    fontSize: 12,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
});
