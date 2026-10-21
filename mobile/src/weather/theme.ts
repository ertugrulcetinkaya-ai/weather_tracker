export type WeatherThemeKind = 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'neutral';

export type WeatherTheme = {
  kind: WeatherThemeKind;
  background: string;
  atmosphere: string;
  decoration: string;
  heroSurface: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  mutedText: string;
  accent: string;
  accentSoft: string;
  activeText: string;
  errorText: string;
  statusBarStyle: 'dark' | 'light';
};

const THEMES: Record<WeatherThemeKind, WeatherTheme> = {
  sunny: {
    kind: 'sunny',
    background: '#C6E7F8',
    atmosphere: '#F3F8FB',
    decoration: '#F7C96A',
    heroSurface: '#FFF9EA',
    surface: '#FFFFFF',
    surfaceBorder: '#D5E6EE',
    text: '#15324D',
    mutedText: '#526B80',
    accent: '#875300',
    accentSoft: '#FFF0C7',
    activeText: '#FFFFFF',
    errorText: '#A61B1B',
    statusBarStyle: 'dark',
  },
  cloudy: {
    kind: 'cloudy',
    background: '#D7DEE5',
    atmosphere: '#F4F7F9',
    decoration: '#9CAEBB',
    heroSurface: '#FCFDFE',
    surface: '#FCFDFE',
    surfaceBorder: '#CFD9E0',
    text: '#253849',
    mutedText: '#526879',
    accent: '#4A6173',
    accentSoft: '#E5EEF3',
    activeText: '#FFFFFF',
    errorText: '#A61B1B',
    statusBarStyle: 'dark',
  },
  rainy: {
    kind: 'rainy',
    background: '#07192D',
    atmosphere: '#102E4B',
    decoration: '#73CCFF',
    heroSurface: '#112C47',
    surface: '#112C47',
    surfaceBorder: '#254760',
    text: '#F2F7FC',
    mutedText: '#BFD0DE',
    accent: '#73CCFF',
    accentSoft: '#183C58',
    activeText: '#07192D',
    errorText: '#FFB4AB',
    statusBarStyle: 'light',
  },
  snowy: {
    kind: 'snowy',
    background: '#D9F0FA',
    atmosphere: '#F6FBFE',
    decoration: '#78B9D5',
    heroSurface: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceBorder: '#C9E5F0',
    text: '#16374F',
    mutedText: '#4F6E83',
    accent: '#276A8B',
    accentSoft: '#E8F7FC',
    activeText: '#FFFFFF',
    errorText: '#A61B1B',
    statusBarStyle: 'dark',
  },
  neutral: {
    kind: 'neutral',
    background: '#E9EFF3',
    atmosphere: '#F8FAFB',
    decoration: '#A9BBC7',
    heroSurface: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceBorder: '#D5E0E6',
    text: '#253849',
    mutedText: '#526879',
    accent: '#476275',
    accentSoft: '#E9F0F4',
    activeText: '#FFFFFF',
    errorText: '#A61B1B',
    statusBarStyle: 'dark',
  },
};

const RAIN_CODES = new Set([
  51, 53, 55, 56, 57,
  61, 63, 65, 66, 67,
  80, 81, 82,
  95, 96, 99,
]);

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

/** Resolve a stable visual theme from the current WMO weather code. */
export function getWeatherTheme(weatherCode: number | null | undefined): WeatherTheme {
  if (weatherCode === 0 || weatherCode === 1) {
    return THEMES.sunny;
  }

  if (weatherCode === 2 || weatherCode === 3 || weatherCode === 45 || weatherCode === 48) {
    return THEMES.cloudy;
  }

  if (SNOW_CODES.has(weatherCode ?? Number.NaN)) {
    return THEMES.snowy;
  }

  if (RAIN_CODES.has(weatherCode ?? Number.NaN)) {
    return THEMES.rainy;
  }

  return THEMES.neutral;
}
