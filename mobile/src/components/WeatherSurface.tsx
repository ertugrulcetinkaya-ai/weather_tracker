import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { getWeatherTheme } from '../weather/theme';

type WeatherSurfaceProps = PropsWithChildren<{
  weatherCode: number | null | undefined;
}>;

const RAIN_STREAKS = [
  { left: '8%', top: 120, height: 30, rotate: '-14deg' },
  { left: '22%', top: 210, height: 22, rotate: '-12deg' },
  { left: '44%', top: 152, height: 34, rotate: '-13deg' },
  { left: '68%', top: 108, height: 26, rotate: '-15deg' },
  { left: '86%', top: 245, height: 32, rotate: '-12deg' },
  { left: '31%', top: 390, height: 24, rotate: '-14deg' },
  { left: '76%', top: 470, height: 30, rotate: '-12deg' },
] as const;

const SNOW_CRYSTALS = [
  { left: '12%', top: 148, scale: 1 },
  { left: '76%', top: 204, scale: 0.75 },
  { left: '37%', top: 350, scale: 0.65 },
  { left: '88%', top: 438, scale: 1 },
  { left: '19%', top: 548, scale: 0.7 },
] as const;

export function WeatherSurface({ weatherCode, children }: WeatherSurfaceProps) {
  const theme = getWeatherTheme(weatherCode);

  return (
    <View style={[styles.surface, { backgroundColor: theme.background }]}>
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      >
        <View style={[styles.topWash, { backgroundColor: theme.atmosphere }]} />
        {theme.kind === 'sunny' && (
          <>
            <View style={[styles.sunHalo, styles.sunHaloPrimary, { backgroundColor: theme.decoration }]} />
            <View style={[styles.sunHalo, styles.sunHaloSecondary, { backgroundColor: theme.atmosphere }]} />
          </>
        )}
        {theme.kind === 'cloudy' && (
          <>
            <View style={[styles.cloudLayer, styles.cloudLayerTop, { backgroundColor: theme.decoration }]} />
            <View style={[styles.cloudLayer, styles.cloudLayerLower, { backgroundColor: theme.atmosphere }]} />
          </>
        )}
        {theme.kind === 'rainy' && RAIN_STREAKS.map((streak, index) => (
          <View
            key={`rain-${index}`}
            style={[
              styles.rainStreak,
              {
                backgroundColor: theme.decoration,
                height: streak.height,
                left: streak.left,
                top: streak.top,
                transform: [{ rotate: streak.rotate }],
              },
            ]}
          />
        ))}
        {theme.kind === 'snowy' && SNOW_CRYSTALS.map((crystal, index) => (
          <View
            key={`snow-${index}`}
            style={[
              styles.crystal,
              {
                left: crystal.left,
                top: crystal.top,
                transform: [{ scale: crystal.scale }],
              },
            ]}
          >
            <View style={[styles.crystalArm, { backgroundColor: theme.decoration }]} />
            <View style={[styles.crystalArm, styles.crystalArmDiagonalOne, { backgroundColor: theme.decoration }]} />
            <View style={[styles.crystalArm, styles.crystalArmDiagonalTwo, { backgroundColor: theme.decoration }]} />
          </View>
        ))}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  topWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    opacity: 0.38,
  },
  sunHalo: {
    position: 'absolute',
    borderRadius: 999,
  },
  sunHaloPrimary: {
    width: 260,
    height: 260,
    top: 110,
    right: -118,
    opacity: 0.2,
  },
  sunHaloSecondary: {
    width: 180,
    height: 180,
    top: 390,
    left: -115,
    opacity: 0.36,
  },
  cloudLayer: {
    position: 'absolute',
    height: 150,
    borderRadius: 100,
  },
  cloudLayerTop: {
    width: 320,
    top: 34,
    right: -212,
    opacity: 0.22,
  },
  cloudLayerLower: {
    width: 280,
    top: 305,
    left: -185,
    opacity: 0.26,
  },
  rainStreak: {
    position: 'absolute',
    width: 2,
    borderRadius: 2,
    opacity: 0.14,
  },
  crystal: {
    position: 'absolute',
    width: 18,
    height: 18,
    opacity: 0.24,
  },
  crystalArm: {
    position: 'absolute',
    width: 2,
    height: 18,
    left: 8,
    top: 0,
    borderRadius: 2,
  },
  crystalArmDiagonalOne: {
    transform: [{ rotate: '60deg' }],
  },
  crystalArmDiagonalTwo: {
    transform: [{ rotate: '-60deg' }],
  },
});
