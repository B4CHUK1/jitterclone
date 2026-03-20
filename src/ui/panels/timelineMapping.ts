export const BASE_PIXELS_PER_SECOND = 120;

export interface TimelineTimeScale {
  duration: number;
  zoom: number;
  pixelsPerSecond: number;
  contentWidth: number;
  toX: (time: number) => number;
  toTime: (x: number) => number;
  clampTime: (time: number) => number;
}

export function createTimelineTimeScale(duration: number, zoom: number): TimelineTimeScale {
  const safeDuration = Math.max(0, duration);
  const pixelsPerSecond = BASE_PIXELS_PER_SECOND * Math.max(0.25, zoom);

  const clampTime = (time: number) => Math.max(0, Math.min(safeDuration, time));
  const toX = (time: number) => clampTime(time) * pixelsPerSecond;
  const toTime = (x: number) => clampTime(Math.max(0, x) / pixelsPerSecond);

  return {
    duration: safeDuration,
    zoom,
    pixelsPerSecond,
    contentWidth: Math.max(640, toX(safeDuration)),
    toX,
    toTime,
    clampTime,
  };
}
