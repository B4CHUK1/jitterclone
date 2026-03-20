export const TIMELINE_LEFT_GUTTER = 8;
export const BASE_PIXELS_PER_SECOND = 120;

export function getPixelsPerSecond(zoom: number): number {
  return BASE_PIXELS_PER_SECOND * zoom;
}

export function timeToPixel(time: number, zoom: number): number {
  return TIMELINE_LEFT_GUTTER + Math.max(0, time) * getPixelsPerSecond(zoom);
}

export function pixelToTime(pixel: number, zoom: number): number {
  return Math.max(0, (pixel - TIMELINE_LEFT_GUTTER) / getPixelsPerSecond(zoom));
}
