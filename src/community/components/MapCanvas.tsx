import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';
import type { PlaceCandidate } from '../types';

interface Props {
  center: { lat: number; lng: number };
  places: PlaceCandidate[];
  selectedPlaceId: string | null;
  onSelect(placeId: string): void;
  onMapReady(map: google.maps.Map): void;
}

function tierColor(score: number | null): string {
  if (score == null) return '#8a97a1';
  if (score >= 7) return '#2d6a4f';
  if (score >= 4) return '#b08b67';
  return '#c4432e';
}

/** Thin wrapper around a raw google.maps.Map — owns the DOM node and marker sync only. */
export function MapCanvas({ center, places, selectedPlaceId, onSelect, onMapReady }: Props) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef(new Map<string, google.maps.Marker>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !divRef.current) return;
        const map = new g.maps.Map(divRef.current, {
          center,
          zoom: 14,
          disableDefaultUI: false,
          streetViewControl: false,
        });
        mapRef.current = map;
        onMapReady(map);
      })
      // Without this the rejection is unhandled and the user gets a blank grey
      // rectangle with no explanation — which is exactly what a referrer-
      // restricted key or a blocked network looks like.
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.panTo(center);
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;

    const seen = new Set<string>();
    for (const place of places) {
      seen.add(place.placeId);
      let marker = markersRef.current.get(place.placeId);
      const color = tierColor(place.score?.avgScore ?? null);
      const isSelected = place.placeId === selectedPlaceId;

      const icon: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#eef1ee',
        strokeWeight: 2,
        scale: isSelected ? 11 : 8,
      };

      if (!marker) {
        marker = new google.maps.Marker({
          map,
          position: { lat: place.lat, lng: place.lng },
          title: place.name,
          icon,
        });
        marker.addListener('click', () => onSelectRef.current(place.placeId));
        markersRef.current.set(place.placeId, marker);
      } else {
        marker.setPosition({ lat: place.lat, lng: place.lng });
        marker.setIcon(icon);
      }
    }

    for (const [placeId, marker] of markersRef.current) {
      if (!seen.has(placeId)) {
        marker.setMap(null);
        markersRef.current.delete(placeId);
      }
    }
  }, [places, selectedPlaceId]);

  if (loadError) {
    return (
      <div id="map-canvas" className="map-failed">
        <div>
          <strong>The map could not load.</strong>
          <p>{loadError}</p>
          <p>
            Usually one of: the key is wrong, <strong>Maps JavaScript API</strong> or{' '}
            <strong>Places API (New)</strong> is not enabled on that Google Cloud project, billing
            is not active on the project, or the key is restricted to referrers that do not include{' '}
            <code>{window.location.host}</code>.
          </p>
        </div>
      </div>
    );
  }

  return <div id="map-canvas" ref={divRef} />;
}
