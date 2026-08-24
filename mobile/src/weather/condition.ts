export type WeatherCondition = {
  label: string;
  emoji: string;
};

const WEATHER_CONDITIONS: Record<number, WeatherCondition> = {
  0: { label: 'Açık', emoji: '☀️' },
  1: { label: 'Çoğunlukla açık', emoji: '🌤️' },
  2: { label: 'Parçalı bulutlu', emoji: '⛅' },
  3: { label: 'Kapalı', emoji: '☁️' },
  45: { label: 'Sisli', emoji: '🌫️' },
  48: { label: 'Sisli', emoji: '🌫️' },
  51: { label: 'Çiseleme', emoji: '🌦️' },
  53: { label: 'Çiseleme', emoji: '🌦️' },
  55: { label: 'Çiseleme', emoji: '🌦️' },
  56: { label: 'Donan çiseleme', emoji: '🌧️' },
  57: { label: 'Donan çiseleme', emoji: '🌧️' },
  61: { label: 'Yağmurlu', emoji: '🌧️' },
  63: { label: 'Yağmurlu', emoji: '🌧️' },
  65: { label: 'Yağmurlu', emoji: '🌧️' },
  66: { label: 'Donan yağmur', emoji: '🌧️' },
  67: { label: 'Donan yağmur', emoji: '🌧️' },
  71: { label: 'Karlı', emoji: '🌨️' },
  73: { label: 'Karlı', emoji: '🌨️' },
  75: { label: 'Karlı', emoji: '🌨️' },
  77: { label: 'Kar taneleri', emoji: '🌨️' },
  80: { label: 'Sağanak yağış', emoji: '🌦️' },
  81: { label: 'Sağanak yağış', emoji: '🌦️' },
  82: { label: 'Sağanak yağış', emoji: '🌦️' },
  85: { label: 'Kar sağanağı', emoji: '🌨️' },
  86: { label: 'Kar sağanağı', emoji: '🌨️' },
  95: { label: 'Gök gürültülü fırtına', emoji: '⛈️' },
  96: { label: 'Dolu ihtimalli fırtına', emoji: '⛈️' },
  99: { label: 'Dolu ihtimalli fırtına', emoji: '⛈️' },
};

const FALLBACK_CONDITION: WeatherCondition = {
  label: 'Hava durumu',
  emoji: '🌡️',
};

export function getWeatherCondition(code: number): WeatherCondition {
  return WEATHER_CONDITIONS[code] ?? FALLBACK_CONDITION;
}

export function formatWeatherTime(time: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(time);
  if (!match) {
    return 'Güncelleme zamanı bilinmiyor';
  }
  return `${match[4]}:${match[5]} itibarıyla`;
}
