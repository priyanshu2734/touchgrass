import { describe, expect, it, vi } from 'vitest';
import { GeolocationError, getDevicePosition } from './geolocation';

const fake = (impl: Geolocation['getCurrentPosition']) => ({ getCurrentPosition: impl });

describe('getDevicePosition', () => {
  it('resolves with coordinates on success', async () => {
    const geo = fake((ok) => ok({ coords: { latitude: 20.5, longitude: 85.5 } } as GeolocationPosition));
    await expect(getDevicePosition(geo)).resolves.toEqual({ lat: 20.5, lon: 85.5 });
  });
  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ])('maps error code %s to %s', async (code, reason) => {
    const geo = fake((_ok, fail) => fail?.({ code } as GeolocationPositionError));
    await expect(getDevicePosition(geo)).rejects.toMatchObject({ reason });
  });
  it('rejects when geolocation is unsupported', async () => {
    await expect(getDevicePosition(undefined)).rejects.toBeInstanceOf(GeolocationError);
  });
  it('rejects impossible coordinates', async () => {
    const geo = fake((ok) => ok({ coords: { latitude: 400, longitude: 0 } } as GeolocationPosition));
    await expect(getDevicePosition(geo)).rejects.toMatchObject({ reason: 'unavailable' });
  });
  it('does not call the browser until invoked', () => {
    const spy = vi.fn();
    fake(spy);
    expect(spy).not.toHaveBeenCalled();
  });
});
