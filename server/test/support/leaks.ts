import { expect } from 'vitest';
import { homeCoordinates } from './fixtures';

const EARTH_RADIUS_M = 6_371_000;

export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** No home location, under any name or as a bare number, anywhere in the payload. */
export function expectNoHomeLocation(payload: unknown): void {
  const text = JSON.stringify(payload) ?? '';
  expect(text).not.toMatch(/home_?lat|home_?lng|homeLat|homeLng|home_location/i);
  for (const coordinate of homeCoordinates) {
    expect(text, `home coordinate ${coordinate} leaked`).not.toContain(String(coordinate));
  }
}

/** Neither the exact coordinates nor the place name of a meeting point appear in the payload. */
export function expectNoExactPoint(
  payload: unknown,
  point: { placeName: string; latitude: number; longitude: number },
): void {
  const text = JSON.stringify(payload) ?? '';
  expect(text).not.toContain(point.placeName);
  expect(text).not.toContain(String(point.latitude));
  expect(text).not.toContain(String(point.longitude));
}
