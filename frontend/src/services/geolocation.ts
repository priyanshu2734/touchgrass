import type { LatLon } from '../utils/geo';
import { isValidLatLon } from '../utils/geo';

export type GeolocationFailure = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class GeolocationError extends Error {
  reason: GeolocationFailure;
  constructor(reason: GeolocationFailure, message: string) {
    super(message);
    this.name = 'GeolocationError';
    this.reason = reason;
  }
}

const MESSAGES: Record<GeolocationFailure, string> = {
  unsupported: 'This browser cannot share a location. Type a place name or coordinates instead.',
  denied: 'Location was not shared, which is fine. Type a place name or coordinates instead.',
  unavailable: 'Your device could not work out where you are. Type a place name or coordinates instead.',
  timeout: 'Finding your location took too long. Try again, or type a place name instead.',
};

/**
 * Asks the browser for a one-off position. Call this ONLY from a click handler: it triggers the permission prompt.
 * Nothing is watched, stored or sent from here.
 */
export function getDevicePosition(
  geo: Pick<Geolocation, 'getCurrentPosition'> | undefined = typeof navigator !== 'undefined' ? navigator.geolocation : undefined,
): Promise<LatLon> {
  return new Promise((resolve, reject) => {
    if (!geo) {
      reject(new GeolocationError('unsupported', MESSAGES.unsupported));
      return;
    }
    geo.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (!isValidLatLon(latitude, longitude)) reject(new GeolocationError('unavailable', MESSAGES.unavailable));
        else resolve({ lat: latitude, lon: longitude });
      },
      (error) => {
        const reason: GeolocationFailure = error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable';
        reject(new GeolocationError(reason, MESSAGES[reason]));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
