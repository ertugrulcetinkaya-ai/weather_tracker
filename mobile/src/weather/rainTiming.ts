import type { RainEvent } from '../types/weather';

type WallTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type RainTiming =
  | { status: 'future'; millisecondsUntilStart: number }
  | { status: 'ongoing' }
  | { status: 'ended' }
  | { status: 'unavailable' };

function parseWallTime(value: string): WallTime | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const [, year, month, day, hour, minute] = match;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
  const check = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute),
  );
  if (
    check.getUTCFullYear() !== parts.year ||
    check.getUTCMonth() + 1 !== parts.month ||
    check.getUTCDate() !== parts.day ||
    parts.hour > 23 ||
    parts.minute > 59
  ) {
    return null;
  }
  return parts;
}

function getWallTime(epochMilliseconds: number, timezone: string): WallTime | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(epochMilliseconds));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const result = {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour),
      minute: Number(values.minute),
    };
    return Object.values(result).every(Number.isFinite) ? result : null;
  } catch {
    return null;
  }
}

function wallTimeToEpochCandidates(value: string, timezone: string): number[] {
  const wallTime = parseWallTime(value);
  if (wallTime === null) return [];

  const wallEpoch = Date.UTC(
    wallTime.year,
    wallTime.month - 1,
    wallTime.day,
    wallTime.hour,
    wallTime.minute,
  );
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sampleEpoch = wallEpoch + hours * 60 * 60 * 1000;
    const sampleWallTime = getWallTime(sampleEpoch, timezone);
    if (sampleWallTime === null) return [];
    const sampleWallEpoch = Date.UTC(
      sampleWallTime.year,
      sampleWallTime.month - 1,
      sampleWallTime.day,
      sampleWallTime.hour,
      sampleWallTime.minute,
    );
    offsets.add(sampleWallEpoch - sampleEpoch);
  }

  return [...offsets]
    .map((offset) => wallEpoch - offset)
    .filter((candidate) => {
      const candidateWallTime = getWallTime(candidate, timezone);
      return (
        candidateWallTime !== null &&
        candidateWallTime.year === wallTime.year &&
        candidateWallTime.month === wallTime.month &&
        candidateWallTime.day === wallTime.day &&
        candidateWallTime.hour === wallTime.hour &&
        candidateWallTime.minute === wallTime.minute
      );
    })
    .sort((left, right) => left - right);
}

export function getRainTiming(
  event: RainEvent,
  timezone: string,
  nowMilliseconds: number,
): RainTiming {
  const starts = wallTimeToEpochCandidates(event.start_time, timezone);
  const ends = wallTimeToEpochCandidates(event.end_time, timezone);
  if (starts.length !== 1 || ends.length !== 1) {
    return { status: 'unavailable' };
  }

  const [start] = starts;
  const [end] = ends;
  if (end <= start) return { status: 'unavailable' };

  if (nowMilliseconds >= start && nowMilliseconds < end) {
    return { status: 'ongoing' };
  }

  if (start > nowMilliseconds) {
    return {
      status: 'future',
      millisecondsUntilStart: start - nowMilliseconds,
    };
  }
  return { status: 'ended' };
}

export function formatRainCountdown(millisecondsUntilStart: number): string {
  const totalMinutes = Math.max(1, Math.ceil(millisecondsUntilStart / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const duration =
    hours > 0
      ? minutes > 0
        ? `${hours} saat ${minutes} dakika`
        : `${hours} saat`
      : `${minutes} dakika`;
  return `Başlamasına ${duration} kaldı.`;
}
