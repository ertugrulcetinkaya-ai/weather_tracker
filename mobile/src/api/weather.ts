import type { CurrentWeather, HourlyWeather, RainEvent } from '../types/weather';

import { BACKEND_URL } from './config';

export async function fetchCurrentWeather(): Promise<CurrentWeather> {
  const response = await fetch(`${BACKEND_URL}/weather/current`);
  if (!response.ok) {
    throw new Error(`Weather request failed with status ${response.status}`);
  }
  const data = (await response.json()) as CurrentWeather;
  if (
    typeof data.location !== 'string' ||
    typeof data.temperature !== 'number' ||
    typeof data.apparent_temperature !== 'number' ||
    typeof data.humidity !== 'number' ||
    typeof data.wind_speed !== 'number' ||
    typeof data.weather_code !== 'number' ||
    typeof data.time !== 'string'
  ) {
    throw new Error('Unexpected weather response');
  }
  return data;
}

export async function fetchHourlyWeather(): Promise<HourlyWeather[]> {
  const response = await fetch(`${BACKEND_URL}/weather/hourly`);
  if (!response.ok) {
    throw new Error(`Hourly weather request failed with status ${response.status}`);
  }
  const data = (await response.json()) as HourlyWeather[];
  if (
    !Array.isArray(data) ||
    data.length === 0 ||
    data.some(
      (item) =>
        typeof item.time !== 'string' ||
        typeof item.temperature !== 'number' ||
        typeof item.precipitation !== 'number' ||
        typeof item.weather_code !== 'number' ||
        typeof item.wind_speed !== 'number'
    )
  ) {
    throw new Error('Unexpected hourly weather response');
  }
  return data;
}

export async function fetchNextRainEvent(): Promise<RainEvent | null> {
  const response = await fetch(`${BACKEND_URL}/weather/rain/next`);
  if (!response.ok) {
    throw new Error(`Rain event request failed with status ${response.status}`);
  }
  const data = (await response.json()) as RainEvent | null;
  if (data === null) {
    return null;
  }
  if (
    typeof data.start_time !== 'string' ||
    typeof data.end_time !== 'string' ||
    typeof data.total_precipitation !== 'number' ||
    typeof data.peak_time !== 'string'
  ) {
    throw new Error('Unexpected rain event response');
  }
  return data;
}
