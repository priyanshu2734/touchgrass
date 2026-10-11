/**
 * DEMO PLACES. Real, well-known parks in London with their real coordinates. They are shown only in demo mode,
 * whatever area you search for, and the UI says so. No opening hours, ratings or accessibility data are included
 * because this file does not have them and will not guess.
 */
import type { Place, PlaceCategory } from '../types';

export const DEMO_PLACES: Place[] = [
  { id: 'demo:hyde-park', name: 'Hyde Park', category: 'Park', categoryId: 'park', lat: 51.5073, lon: -0.1657, named: true },
  { id: 'demo:kensington-gardens', name: 'Kensington Gardens', category: 'Park', categoryId: 'park', lat: 51.5073, lon: -0.1877, named: true },
  { id: 'demo:regents-park', name: "Regent's Park", category: 'Park', categoryId: 'park', lat: 51.5313, lon: -0.157, named: true },
  { id: 'demo:st-james-park', name: "St James's Park", category: 'Park', categoryId: 'park', lat: 51.5025, lon: -0.1348, named: true },
  { id: 'demo:kew-gardens', name: 'Royal Botanic Gardens, Kew', category: 'Garden', categoryId: 'garden', lat: 51.4787, lon: -0.2956, named: true },
  { id: 'demo:primrose-hill', name: 'Primrose Hill', category: 'Viewpoint', categoryId: 'viewpoint', lat: 51.5395, lon: -0.1608, named: true },
];

export const PLACE_CATEGORIES: PlaceCategory[] = [
  { id: 'park', label: 'Park', defaultOn: true },
  { id: 'garden', label: 'Garden', defaultOn: true },
  { id: 'nature_reserve', label: 'Nature reserve', defaultOn: true },
  { id: 'woodland', label: 'Woodland', defaultOn: true },
  { id: 'viewpoint', label: 'Viewpoint', defaultOn: true },
  { id: 'beach', label: 'Beach', defaultOn: true },
  { id: 'lake', label: 'Lake or pond', defaultOn: true },
  { id: 'trail', label: 'Named path or trail', defaultOn: false },
];
