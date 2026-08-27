export type WeatherLocation = {
  name: string;
  latitude: number;
  longitude: number;
};

export type CurrentWeather = {
  location: string;
  temperature: number;
  apparent_temperature: number;
  humidity: number;
  wind_speed: number;
  weather_code: number;
  time: string;
};

export type HourlyWeather = {
  time: string;
  temperature: number;
  precipitation: number;
  weather_code: number;
  wind_speed: number;
};

export type RainEvent = {
  start_time: string;
  end_time: string;
  total_precipitation: number;
  peak_time: string;
};

export type LocationSearchResult = {
  name: string;
  latitude: number;
  longitude: number;
  admin1: string | null;
  country: string;
};
