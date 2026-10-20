import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { HourlyWeather } from '../types/weather';
import { getWeatherCondition } from '../weather/condition';
import { formatPrecipitation } from '../weather/format';

type HourlyForecastProps = {
  hourly: HourlyWeather[];
  rainStartTime?: string | null;
};

function formatHour(time: string): string {
  const timePart = time.split('T')[1] ?? time;
  const match = timePart.match(/^(\d{2}):(\d{2})/);
  return match ? match[1] + ':' + match[2] : timePart;
}

function followingHour(time: string): string | null {
  // Treat the wall-clock components as UTC so incrementing is device-timezone independent.
  const timestamp = Date.parse(time + ':00Z');
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function HourlyForecast({
  hourly,
  rainStartTime = null,
}: HourlyForecastProps) {
  const rainStartRecordTime =
    rainStartTime === null ? null : followingHour(rainStartTime);
  const firstRainStartIndex =
    rainStartRecordTime === null
      ? -1
      : hourly.findIndex((candidate) => candidate.time === rainStartRecordTime);

  return (
    <>
      <Text style={styles.hourlyTitle}>Saatlik Tahmin</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.hourlyScroll}
        contentContainerStyle={styles.hourlyContent}
      >
        {hourly.map((hour, index) => {
          const isFirstRainStart =
            index === firstRainStartIndex && hour.precipitation > 0;
          const rainStartLabel =
            isFirstRainStart && rainStartTime !== null
              ? [
                  'Yağış başlangıcı saat ',
                  formatHour(rainStartTime),
                  '; saatlik sıcaklık saati ',
                  formatHour(hour.time),
                  ', sıcaklık ',
                  String(Math.round(hour.temperature)),
                  '°C; ',
                  formatHour(rainStartTime),
                  '–',
                  formatHour(hour.time),
                  ' aralığında yağış ihtimali %',
                  String(hour.precipitation_probability),
                  ', yağış miktarı ',
                  formatPrecipitation(hour.precipitation),
                  ' mm',
                ].join('')
              : '';
          return (
            <View
              key={hour.time}
              style={[
                styles.hourlyCard,
                isFirstRainStart && styles.hourlyCardRainStart,
              ]}
              accessible={isFirstRainStart}
              accessibilityLabel={rainStartLabel}
              accessibilityRole="text"
            >
              <Text style={styles.hourlyTime}>{hour.time.slice(11, 16)}</Text>
              {isFirstRainStart && rainStartTime !== null && (
                <View style={styles.hourlyRainStartMarker} testID="rain-start-marker">
                  <Text style={styles.hourlyRainStartLabel}>Yağış başlar</Text>
                  <Text style={styles.hourlyRainStartTime}>
                    {formatHour(rainStartTime)}
                  </Text>
                </View>
              )}
              <Text style={styles.hourlyEmoji}>
                {getWeatherCondition(hour.weather_code).emoji}
              </Text>
              <Text style={styles.hourlyTemperature}>
                {Math.round(hour.temperature)}°C
              </Text>
              <Text style={styles.hourlyProbability}>
                Yağış %{hour.precipitation_probability}
              </Text>
              <Text style={styles.hourlyPrecipitation}>
                {formatPrecipitation(hour.precipitation)} mm
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  hourlyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  hourlyScroll: {
    width: '100%',
    height: 160,
    flexGrow: 0,
  },
  hourlyContent: {
    flexDirection: 'row',
    paddingRight: 16,
    alignItems: 'flex-start',
  },
  hourlyCard: {
    width: 72,
    height: 150,
    backgroundColor: '#f2f6fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e8f0',
    padding: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  hourlyCardRainStart: {
    borderWidth: 2,
    borderColor: '#0ea5e9',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
  },
  hourlyTime: {
    fontSize: 11,
    color: '#777',
    marginBottom: 6,
  },
  hourlyRainStartMarker: {
    alignItems: 'center',
  },
  hourlyRainStartLabel: {
    maxWidth: 60,
    fontSize: 8.5,
    lineHeight: 10,
    fontWeight: '600',
    color: '#0369a1',
    textAlign: 'center',
  },
  hourlyRainStartTime: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: 'bold',
    color: '#0369a1',
  },
  hourlyEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  hourlyTemperature: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  hourlyProbability: {
    fontSize: 10,
    color: '#2563eb',
    marginBottom: 2,
  },
  hourlyPrecipitation: {
    fontSize: 10,
    color: '#555',
  },
});
