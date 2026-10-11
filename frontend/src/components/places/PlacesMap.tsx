import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { MAP_ATTRIBUTION, MAP_TILE_URL, USING_PUBLIC_OSM_TILES } from '../../services/config';
import type { Place } from '../../types';
import type { LatLon } from '../../utils/geo';

interface PlacesMapProps {
  places: Place[];
  origin: LatLon | null;
  selectedId: string | null;
  onSelect: (place: Place) => void;
}

const placeIcon = (selected: boolean) =>
  L.divIcon({
    className: 'tg-marker-wrap',
    html: `<span class="tg-marker${selected ? ' tg-marker-selected' : ''}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
const originIcon = L.divIcon({
  className: 'tg-marker-wrap',
  html: '<span class="tg-marker-origin"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/** Optional map view (loaded lazily). The list view always carries the same information. */
export default function PlacesMap({ places, origin, selectedId, onSelect }: PlacesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const map = L.map(containerRef.current, { zoomAnimation: !reduceMotion, fadeAnimation: !reduceMotion, minZoom: 3 });
    L.tileLayer(MAP_TILE_URL, { maxZoom: 19, attribution: MAP_ATTRIBUTION }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.setView([0, 0], 2);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const points: L.LatLngExpression[] = [];

    if (origin) {
      L.marker([origin.lat, origin.lon], { icon: originIcon, title: 'Your search point', alt: 'Your search point', keyboard: false }).addTo(layer);
      points.push([origin.lat, origin.lon]);
    }
    for (const place of places) {
      const marker = L.marker([place.lat, place.lon], {
        icon: placeIcon(place.id === selectedId),
        title: place.name,
        alt: `${place.name}, ${place.category}`,
        keyboard: true,
      });
      marker.on('click', () => onSelectRef.current(place));
      marker.addTo(layer);
      points.push([place.lat, place.lon]);
    }
    if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 16 });
  }, [places, origin, selectedId]);

  return (
    <div>
      <div
        ref={containerRef}
        role="application"
        aria-label="Map of the places in the list. The list view has the same information."
        className="h-[26rem] w-full overflow-hidden rounded-2xl border border-forest-800/15 bg-sage-100 sm:h-[32rem]"
      />
      {USING_PUBLIC_OSM_TILES && (
        <p className="mt-2 text-xs text-forest-600">
          Map tiles come from the public OpenStreetMap server, which suits development and light use. Set VITE_MAP_TILE_URL to a tile provider
          before launching to many users.
        </p>
      )}
    </div>
  );
}
