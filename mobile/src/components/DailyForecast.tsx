import { StyleSheet, Text, View } from 'react-native';

import type { DailyWeather } from '../types/weather';
import { getWeatherCondition } from '../weather/condition';

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
};

// Deterministic on the provider's YYYY-MM-DD calendar date: UTC construction
// keeps the weekday independent of the device timezone or locale.
function formatDayLabel(date: string): string {
  const match = DAILY_DATE_PATTERN.exec(date);
  if (!match) {
    return date;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const weekday = WEEKDAY_LABELS[parsed.getUTCDay()];
  const monthLabel = MONTH_LABELS[month - 1];
  if (Number.isNaN(parsed.getTime()) || !weekday || !monthLabel) {
    return date;
  }
  return `${weekday}, ${day} ${monthLabel}`;
}

export function DailyForecast({ daily }: DailyForecastProps) {
  return (
    <>
      <Text style={styles.dailyTitle}>7 Günlük Tahmin</Text>
      <View style={styles.dailyList}>
        {daily.map((day) => {
          const condition = getWeatherCondition(day.weather_code);
          return (
            <View key={day.date} style={styles.dailyCard}>
              <View style={styles.dailyMain}>
                <Text style={styles.dailyDate}>{formatDayLabel(day.date)}</Text>
                <View style={styles.dailyConditionRow}>
                  <Text style={styles.dailyEmoji}>{condition.emoji}</Text>
                  <Text style={styles.dailyCondition}>{condition.label}</Text>
                </View>
                <Text style={styles.dailyProbability}>
                  Yağış %{day.precipitation_probability}
                </Text>
                {day.precipitation > 0 ? (
                  <Text style={styles.dailyPrecipitation}>
                    {day.precipitation} mm
                  </Text>
                ) : null}
              </View>
              <Text style={styles.dailyTemperature}>
                {Math.round(day.temperature_min)}° / {Math.round(day.temperature_max)}°
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f2f6fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e8f0',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dailyMain: {
    flexShrink: 1,
  },
  dailyDate: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  dailyConditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  dailyEmoji: {
    fontSize: 18,
  },
  dailyCondition: {
    fontSize: 13,
    color: '#555',
  },
  dailyProbability: {
    fontSize: 12,
    color: '#2563eb',
  },
  dailyPrecipitation: {
    fontSize: 12,
    color: '#555',
  },
  dailyTemperature: {
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 12,
  },
});
