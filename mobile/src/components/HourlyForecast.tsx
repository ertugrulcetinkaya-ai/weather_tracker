import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { HourlyWeather } from '../types/weather';
import { getWeatherCondition } from '../weather/condition';
import { formatPrecipitation } from '../weather/format';

type HourlyForecastProps = {
  hourly: HourlyWeather[];
};

export function HourlyForecast({ hourly }: HourlyForecastProps) {
  return (
    <>
      <Text style={styles.hourlyTitle}>Saatlik Tahmin</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.hourlyScroll}
        contentContainerStyle={styles.hourlyContent}
      >
        {hourly.map((hour) => (
          <View key={hour.time} style={styles.hourlyCard}>
            <Text style={styles.hourlyTime}>{hour.time.slice(11, 16)}</Text>
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
        ))}
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
  hourlyTime: {
    fontSize: 11,
    color: '#777',
    marginBottom: 6,
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
