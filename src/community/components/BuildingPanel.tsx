import { useEffect, useState } from 'react';
import { fetchReportsForPlace } from '../lib/supabase';
import { goToUpload } from '../lib/router';
import type { PlaceCandidate, StoredReport } from '../types';
import { formatDistance } from '../lib/distance';

interface Props {
  place: PlaceCandidate;
  onClose(): void;
}

export function BuildingPanel({ place, onClose }: Props) {
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
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 26 }}>
              {place.score.avgScore.toFixed(1)}
            </span>
            <span style={{ color: 'var(--ink-40)', fontSize: 13 }}>
              / 10 · {place.score.reportCount} report{place.score.reportCount === 1 ? '' : 's'}
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
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{r.score.toFixed(1)}</span>
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
        <button className="btn primary" style={{ width: '100%' }} onClick={() => goToUpload(place.placeId)}>
          Add an accessibility report
        </button>
      </div>
    </div>
  );
}
