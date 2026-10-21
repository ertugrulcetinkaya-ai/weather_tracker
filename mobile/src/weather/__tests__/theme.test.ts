import { getWeatherTheme } from '../theme';

describe('getWeatherTheme', () => {
  it.each([0, 1])('uses the sunny palette for WMO %i', (code) => {
    expect(getWeatherTheme(code).kind).toBe('sunny');
  });

  it.each([2, 3, 45, 48])('uses the cloudy palette for WMO %i', (code) => {
    expect(getWeatherTheme(code).kind).toBe('cloudy');
  });

  it.each([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])(
    'uses the rainy palette for WMO %i',
    (code) => {
      expect(getWeatherTheme(code).kind).toBe('rainy');
    },
  );

  it.each([71, 73, 75, 77, 85, 86])('uses the snowy palette for WMO %i', (code) => {
    expect(getWeatherTheme(code).kind).toBe('snowy');
  });

  it('keeps freezing rain in the rainy palette and separates rain from snow', () => {
    expect(getWeatherTheme(66).background).toBe('#07192D');
    expect(getWeatherTheme(67).kind).toBe('rainy');
    expect(getWeatherTheme(61).background).not.toBe(getWeatherTheme(71).background);
  });

  it.each([undefined, null, 42, 90, 100])('uses a safe neutral palette for unknown WMO %s', (code) => {
    expect(getWeatherTheme(code).kind).toBe('neutral');
  });

  it('keeps the shared text and action colors above normal-text contrast', () => {
    const codes = [0, 2, 61, 71, 42];

    for (const code of codes) {
      const theme = getWeatherTheme(code);
      expect(contrastRatio(theme.text, theme.heroSurface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.mutedText, theme.heroSurface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.mutedText, theme.accentSoft)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.accent, theme.accentSoft)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.activeText, theme.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
