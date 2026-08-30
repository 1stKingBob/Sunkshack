import { useEffect, useState } from 'react';
import { fetchReportsForPlace } from '../lib/supabase';
import { goToUpload } from '../lib/router';
import type { Building, PlaceCandidate, StoredReport } from '../types';
import { formatDistance } from '../lib/distance';

interface Props {
  place: PlaceCandidate;
  onClose(): void;
  /** Jumps straight into the Dashboard to check this room, with this building carried along to publish against. */
  onCheckRoom(building: Building): void;
}

export function BuildingPanel({ place, onClose, onCheckRoom }: Props) {
  const [reports, setReports] = useState<StoredReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReports(null);
    setError(null);
    fetchReportsForPlace(place.placeId)
      .then((r) => { if (!cancelled) setReports(r); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, [place.placeId]);

  return (
    <div className="building-panel">
      <button className="building-panel-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="building-panel-head">
        <h2>{place.name}</h2>
        <div style={{ fontSize: 12.5, color: 'var(--ink-60)' }}>
          {place.address}
          {place.distanceM != null && ` · ${formatDistance(place.distanceM)} away`}
        </div>
        {place.score ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontWeight: 700,
                fontSize: 15,
                padding: '3px 10px',
                borderRadius: 999,
                background: place.score.accessible ? 'rgba(45, 106, 79, 0.14)' : 'rgba(196, 67, 46, 0.12)',
                color: place.score.accessible ? 'var(--emerald)' : 'var(--crimson)',
              }}
            >
              {place.score.accessible ? 'Accessible' : 'Not accessible'}
            </span>
            <span style={{ color: 'var(--ink-40)', fontSize: 13 }}>
              {place.score.accessibleCount}/{place.score.reportCount} report
              {place.score.reportCount === 1 ? '' : 's'} say yes
            </span>
          </div>
        ) : (
          <div style={{ color: 'var(--ink-40)', fontSize: 12.5, marginTop: 4 }}>
            No accessibility reports yet — be the first.
          </div>
        )}
      </div>

      <div className="building-panel-body">
        {error && <div className="banner error">{error}</div>}
        {reports === null && !error && <div className="empty-hint">Loading reports…</div>}
        {reports?.length === 0 && <div className="empty-hint">No reports yet for this place.</div>}
        {reports?.map((r) => (
          <div className="report-card" key={r.id}>
            <div className="report-card-top">
              <span className="report-card-profile">{r.profileName}</span>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontWeight: 700,
                  color: r.accessible ? 'var(--emerald)' : 'var(--crimson)',
                }}
              >
                {r.accessible ? '✓ Accessible' : '✗ Not accessible'}
              </span>
            </div>
            {r.routes.map((rt, i) => (
              <div className="report-check" data-ok={rt.passes} key={i}>
                <span>{rt.label}</span>
                <span className="v">{Math.round(rt.measuredMm)} mm</span>
              </div>
            ))}
            {r.turning && (
              <div className="report-check" data-ok={r.turning.passes}>
                <span>Turning space</span>
                <span className="v">⌀ {Math.round(r.turning.diameterMm)} mm</span>
              </div>
            )}
            {r.note && <div className="report-note">“{r.note}”</div>}
          </div>
        ))}
      </div>

      <div className="building-panel-actions">
        <button
          className="btn primary"
          style={{ width: '100%' }}
          onClick={() =>
            onCheckRoom({
              placeId: place.placeId,
              name: place.name,
              address: place.address,
              lat: place.lat,
              lng: place.lng,
              category: place.category,
            })
          }
        >
          Check this room →
        </button>
        <button
          className="btn-link"
          style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 8, fontSize: 12 }}
          onClick={() => goToUpload(place.placeId)}
        >
          or upload a report you already exported
        </button>
      </div>
    </div>
  );
}
