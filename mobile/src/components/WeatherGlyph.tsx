import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export type WeatherGlyphKind =
  | 'sunny'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'neutral';

export function getWeatherGlyphKind(code: number): WeatherGlyphKind {
  if (code === 0 || code === 1) return 'sunny';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'neutral';
}

function getWeatherGlyphColors(
  kind: WeatherGlyphKind,
  isDark: boolean,
  palette: 'hourly' | 'daily',
) {
  if (kind === 'sunny') {
    return { cloud: isDark ? '#DDE8F0' : '#8EA3B2', accent: isDark ? '#FFD478' : '#B8770A' };
  }
  if (kind === 'snow') {
    let accent: string;
    if (palette === 'daily') {
      accent = isDark ? '#91F0D1' : '#008F81';
    } else {
      accent = isDark ? '#9DE7FF' : '#348DB7';
    }
    return {
      cloud: isDark ? '#DDE8F0' : '#9CB2C0',
      accent,
    };
  }
  if (kind === 'rain' || kind === 'storm') {
    let accent: string;
    if (isDark) {
      accent = '#8DD6FF';
    } else if (palette === 'daily') {
      accent = '#2478AA';
    } else {
      accent = '#397F9F';
    }
    return {
      cloud: isDark ? '#CAD9E5' : '#8198A9',
      accent,
    };
  }
  return { cloud: isDark ? '#DDE8F0' : '#879CAB', accent: isDark ? '#B9D9E9' : '#526F82' };
}

export function WeatherGlyph({
  kind,
  isDark,
  testID,
  palette = 'hourly',
}: {
  kind: WeatherGlyphKind;
  isDark: boolean;
  testID: string;
  palette?: 'hourly' | 'daily';
}) {
  const { cloud, accent } = getWeatherGlyphColors(kind, isDark, palette);

  return (
    <View
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.weatherGlyph}
    >
      {kind === 'sunny' ? (
        <View style={styles.sunGlyph}>
          <View style={[styles.sunRay, styles.sunRayTop, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayTopRight, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayRight, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayBottomRight, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayBottom, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayBottomLeft, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayLeft, { backgroundColor: accent }]} />
          <View style={[styles.sunRay, styles.sunRayTopLeft, { backgroundColor: accent }]} />
          <View style={[styles.sunDisk, { backgroundColor: accent }]} />
        </View>
      ) : kind === 'neutral' ? (
        <View style={[styles.neutralGlyph, { borderColor: accent }]}>
          <View style={[styles.neutralDot, { backgroundColor: accent }]} />
          <View style={[styles.neutralDot, { backgroundColor: accent }]} />
          <View style={[styles.neutralDot, { backgroundColor: accent }]} />
        </View>
      ) : (
        <View style={styles.cloudGlyph}>
          <View
            style={[
              styles.cloudPuff,
              { left: 5, top: 7, width: 16, height: 16, backgroundColor: cloud },
            ]}
          />
          <View
            style={[
              styles.cloudPuff,
              { left: 13, top: 2, width: 19, height: 19, backgroundColor: cloud },
            ]}
          />
          <View style={[styles.cloudBase, { backgroundColor: cloud }]} />
          {kind === 'rain' && (
            <>
              <View style={[styles.raindrop, { left: 8, backgroundColor: accent }]} />
              <View style={[styles.raindrop, { left: 16, backgroundColor: accent }]} />
              <View style={[styles.raindrop, { left: 24, backgroundColor: accent }]} />
            </>
          )}
          {kind === 'snow' && (
            <>
              <Snowflake style={styles.snowflakeLeft} color={accent} />
              <Snowflake style={styles.snowflakeRight} color={accent} />
            </>
          )}
          {kind === 'fog' && (
            <>
              <View style={[styles.fogLine, styles.fogLineTop, { backgroundColor: accent }]} />
              <View style={[styles.fogLine, styles.fogLineBottom, { backgroundColor: accent }]} />
            </>
          )}
          {kind === 'storm' && (
            <View style={styles.lightning}>
              <View style={[styles.lightningArm, styles.lightningArmTop]} />
              <View style={[styles.lightningArm, styles.lightningArmBottom]} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Snowflake({ style, color }: { style: StyleProp<ViewStyle>; color: string }) {
  return (
    <View style={[styles.snowflake, style]}>
      <View style={[styles.snowflakeArm, { backgroundColor: color }]} />
      <View style={[styles.snowflakeArm, styles.snowflakeArmDiagonalOne, { backgroundColor: color }]} />
      <View style={[styles.snowflakeArm, styles.snowflakeArmDiagonalTwo, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  weatherGlyph: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center' },
  sunGlyph: { position: 'relative', width: 28, height: 28 },
  sunRay: { position: 'absolute', width: 2, height: 5, borderRadius: 2 },
  sunRayTop: { top: 0, left: 13 },
  sunRayTopRight: { top: 3, left: 22, transform: [{ rotate: '45deg' }] },
  sunRayRight: { top: 12, left: 24, transform: [{ rotate: '90deg' }] },
  sunRayBottomRight: { top: 20, left: 22, transform: [{ rotate: '135deg' }] },
  sunRayBottom: { top: 23, left: 13 },
  sunRayBottomLeft: { top: 20, left: 4, transform: [{ rotate: '45deg' }] },
  sunRayLeft: { top: 12, left: 2, transform: [{ rotate: '90deg' }] },
  sunRayTopLeft: { top: 3, left: 4, transform: [{ rotate: '135deg' }] },
  sunDisk: { position: 'absolute', top: 7, left: 7, width: 14, height: 14, borderRadius: 7 },
  cloudGlyph: { position: 'relative', width: 34, height: 32 },
  cloudPuff: { position: 'absolute', borderRadius: 12 },
  cloudBase: {
    position: 'absolute',
    left: 3,
    top: 12,
    width: 29,
    height: 10,
    borderRadius: 6,
  },
  raindrop: {
    position: 'absolute',
    top: 21,
    width: 3,
    height: 7,
    borderRadius: 3,
    transform: [{ rotate: '18deg' }],
  },
  snowflake: { position: 'absolute', top: 19, width: 13, height: 13 },
  snowflakeLeft: { left: 4 },
  snowflakeRight: { left: 19 },
  snowflakeArm: {
    position: 'absolute',
    top: 0,
    left: 6,
    width: 1.5,
    height: 13,
    borderRadius: 1,
  },
  snowflakeArmDiagonalOne: { transform: [{ rotate: '60deg' }] },
  snowflakeArmDiagonalTwo: { transform: [{ rotate: '120deg' }] },
  fogLine: { position: 'absolute', height: 1.5, borderRadius: 1 },
  fogLineTop: { top: 23, left: 4, width: 14 },
  fogLineBottom: { top: 27, left: 14, width: 15 },
  lightning: { position: 'absolute', top: 17, left: 13, width: 9, height: 14 },
  lightningArm: {
    position: 'absolute',
    left: 3,
    width: 3,
    height: 9,
    backgroundColor: '#F3B941',
    borderRadius: 1,
  },
  lightningArmTop: { top: 0, transform: [{ rotate: '25deg' }] },
  lightningArmBottom: { top: 6, left: 1, transform: [{ rotate: '-25deg' }] },
  neutralGlyph: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  neutralDot: { width: 2, height: 2, borderRadius: 1 },
});
