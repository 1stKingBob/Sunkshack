import { useCallback, useMemo, useRef, useState } from 'react';
import { MapCanvas } from '../components/MapCanvas';
import { BuildingPanel } from '../components/BuildingPanel';
import { fetchScoresForPlaces } from '../lib/supabase';
import { haversineMeters, formatDistance } from '../lib/distance';
import { googleMapsConfigured } from '../lib/googleMaps';
import { searchPlaces, toCandidate } from '../lib/placesSearch';
import { supabaseConfigured } from '../lib/supabase';
import type { PlaceCandidate } from '../types';

const DEFAULT_CENTER = { lat: -33.8688, lng: 151.2093 }; // Sydney — matches the AS 1428.1 figures this project ships with

function scoreTier(score: number | null): 'good' | 'mid' | 'bad' | 'none' {
  if (score == null) return 'none';
  if (score >= 7) return 'good';
  if (score >= 4) return 'mid';
  return 'bad';
}

export function MapPage() {
  const [center] = useState(DEFAULT_CENTER);
  const [query, setQuery] = useState('restaurants');
  const [minScore, setMinScore] = useState(0);
  const [places, setPlaces] = useState<PlaceCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const runSearch = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    setLoading(true);
    setError(null);
    try {
      const results = await searchPlaces(map, query);

      const mapCenter = map.getCenter();
      const centerLat = mapCenter?.lat() ?? center.lat;
      const centerLng = mapCenter?.lng() ?? center.lng;

      const scores = supabaseConfigured
        ? await fetchScoresForPlaces(results.map((r) => r.placeId))
        : new Map();

      const candidates: PlaceCandidate[] = results
        .map((r) =>
          toCandidate(r, haversineMeters(centerLat, centerLng, r.lat, r.lng), scores.get(r.placeId) ?? null),
        )
        .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));

      setPlaces(candidates);

      if (candidates.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        candidates.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        map.fitBounds(bounds, 60);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, center]);

  const filtered = useMemo(
    () => places.filter((p) => (minScore === 0 ? true : (p.score?.avgScore ?? -1) >= minScore)),
    [places, minScore],
  );

  const selected = filtered.find((p) => p.placeId === selectedId) ?? null;

  if (!googleMapsConfigured) {
    return (
      <div className="map-body">
        <div className="sidebar">
          <div className="search-panel">
            <div className="banner error">
              Google Maps isn't configured. Copy <code>community/.env.example</code> to{' '}
              <code>.env.local</code> and set <code>VITE_GOOGLE_MAPS_API_KEY</code>.
            </div>
          </div>
        </div>
        <div className="map-pane" />
      </div>
    );
  }

  return (
    <div className="map-body">
      <div className="sidebar">
        <div className="search-panel">
          {!supabaseConfigured && (
            <div className="banner info">
              Supabase isn't configured — search still works, but scores won't load or save. Set{' '}
              <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>.
            </div>
          )}
          <div className="search-row">
            <input
              type="text"
              placeholder="Search restaurants, buildings, addresses…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
            <button className="btn primary" onClick={runSearch} disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
          <div className="filter-row">
            <span>Min. accessibility</span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
            />
            <span className="value">{minScore === 0 ? 'any' : minScore}</span>
          </div>
          {error && <div className="banner error">{error}</div>}
        </div>

        <div className="place-list">
          {filtered.length === 0 && !loading && (
            <div className="empty-hint">
              {places.length === 0 ? 'Search an area to see places here.' : 'Nothing meets that score filter.'}
            </div>
          )}
          {filtered.map((p) => (
            <div
              className="place-row"
              key={p.placeId}
              data-selected={p.placeId === selectedId}
              onClick={() => {
                setSelectedId(p.placeId);
                mapRef.current?.panTo({ lat: p.lat, lng: p.lng });
              }}
            >
              <div className="place-row-top">
                <span className="place-row-name">{p.name}</span>
                <span className="score-pill" data-tier={scoreTier(p.score?.avgScore ?? null)}>
                  {p.score ? p.score.avgScore.toFixed(1) : '—'}
                </span>
              </div>
              <div className="place-row-meta">
                {p.category ?? 'place'} · {formatDistance(p.distanceM)}
                {p.score && ` · ${p.score.reportCount} report${p.score.reportCount === 1 ? '' : 's'}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="map-pane">
        <MapCanvas
          center={center}
          places={filtered}
          selectedPlaceId={selectedId}
          onSelect={setSelectedId}
          onMapReady={(map) => {
            mapRef.current = map;
          }}
        />
        {selected && <BuildingPanel place={selected} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}
