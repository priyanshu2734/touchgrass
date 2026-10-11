import { isDirectionsProvider, type DirectionsProviderId } from '../utils/directions';

const rawBase = import.meta.env.VITE_API_BASE_URL;
const rawMock = import.meta.env.VITE_USE_MOCK;

/** Base URL of the FastAPI backend. Override with VITE_API_BASE_URL. */
export const API_BASE_URL: string = (rawBase && rawBase.trim() ? rawBase.trim() : 'http://localhost:8000').replace(
  /\/+$/,
  '',
);

/**
 * The app talks to the real backend by default. Set VITE_USE_MOCK=true for a clearly labelled, backend-free demo
 * (no network requests are made and the UI says so).
 */
export const USE_MOCK: boolean = rawMock ? rawMock.trim().toLowerCase() === 'true' : false;

/** Map tiles. The default public OpenStreetMap server is for development and light use only. */
export const MAP_TILE_URL: string =
  import.meta.env.VITE_MAP_TILE_URL?.trim() || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_ATTRIBUTION: string =
  import.meta.env.VITE_MAP_ATTRIBUTION?.trim() ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const USING_PUBLIC_OSM_TILES: boolean = MAP_TILE_URL.includes('tile.openstreetmap.org');

const rawProvider = import.meta.env.VITE_DIRECTIONS_PROVIDER?.trim().toLowerCase();
export const DEFAULT_DIRECTIONS_PROVIDER: DirectionsProviderId = isDirectionsProvider(rawProvider) ? rawProvider : 'osm';
