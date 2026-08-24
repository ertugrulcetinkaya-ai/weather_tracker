import type { CurrentWeather } from '../types/weather';

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
