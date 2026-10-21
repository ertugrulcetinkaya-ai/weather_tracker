export type DailyTemperatureRangeInput = {
  temperature_min: number;
  temperature_max: number;
};

export type DailyTemperatureScale = {
  minimum: number;
  maximum: number;
};

export type DailyTemperatureBar = {
  left: number;
  width: number;
  isPoint: boolean;
};

export function isValidDailyTemperatureRange(
  day: DailyTemperatureRangeInput,
): boolean {
  return (
    Number.isFinite(day.temperature_min) &&
    Number.isFinite(day.temperature_max) &&
    day.temperature_min <= day.temperature_max
  );
}

/** Build one shared scale from valid daily minimum/maximum pairs only. */
export function getDailyTemperatureScale(
  days: DailyTemperatureRangeInput[],
): DailyTemperatureScale | null {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let hasValidDay = false;

  for (const day of days) {
    if (!isValidDailyTemperatureRange(day)) continue;
    hasValidDay = true;
    minimum = Math.min(minimum, day.temperature_min);
    maximum = Math.max(maximum, day.temperature_max);
  }

  return hasValidDay ? { minimum, maximum } : null;
}

/** Position a day's low-high span on the shared weekly scale. */
export function calculateDailyTemperatureBar(
  day: DailyTemperatureRangeInput,
  scale: DailyTemperatureScale | null,
): DailyTemperatureBar | null {
  if (
    !isValidDailyTemperatureRange(day) ||
    scale === null ||
    !Number.isFinite(scale.minimum) ||
    !Number.isFinite(scale.maximum) ||
    scale.minimum > scale.maximum
  ) {
    return null;
  }

  const span = scale.maximum - scale.minimum;
  if (span === 0) {
    return { left: 50, width: 0, isPoint: true };
  }

  const left = Math.max(
    0,
    Math.min(100, ((day.temperature_min - scale.minimum) / span) * 100),
  );
  const right = Math.max(
    left,
    Math.min(100, ((day.temperature_max - scale.minimum) / span) * 100),
  );

  return { left, width: right - left, isPoint: day.temperature_min === day.temperature_max };
}
