import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, googleMapsConfigured } from '../lib/googleMaps';
import { submitReport, supabaseConfigured } from '../lib/supabase';
import { scoreChecks, scoreReport } from '../lib/score';
import { goToMap } from '../lib/router';
import { isWeaveReport, type Building, type WeaveReport } from '../types';

interface Props {
  placeIdParam: string | null;
  reportParam: string | null;
}

function decodeReportParam(param: string | null): WeaveReport | null {
  if (!param) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(param))));
    return isWeaveReport(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function UploadPage({ placeIdParam, reportParam }: Props) {
  const [report, setReport] = useState<WeaveReport | null>(() => decodeReportParam(reportParam));
  const [fileError, setFileError] = useState<string | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [note, setNote] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const autocompleteInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!googleMapsConfigured) return;
    let autocomplete: google.maps.places.Autocomplete | null = null;
    loadGoogleMaps().then((g) => {
      if (!autocompleteInputRef.current) return;
      autocomplete = new g.maps.places.Autocomplete(autocompleteInputRef.current, {
        fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types'],
      });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete!.getPlace();
        if (!place.place_id || !place.geometry?.location) return;
        setBuilding({
          placeId: place.place_id,
          name: place.name ?? 'Unnamed place',
          address: place.formatted_address ?? null,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          category: place.types?.[0]?.replace(/_/g, ' ') ?? null,
        });
      });

      // Arrived from a building's "Add report" button — look the place up directly.
      if (placeIdParam) {
        const service = new g.maps.places.PlacesService(document.createElement('div'));
        service.getDetails(
          { placeId: placeIdParam, fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types'] },
          (place, status) => {
            if (status === g.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
              setBuilding({
                placeId: place.place_id!,
                name: place.name ?? 'Unnamed place',
                address: place.formatted_address ?? null,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                category: place.types?.[0]?.replace(/_/g, ' ') ?? null,
              });
            }
          },
        );
      }
    });
    return () => {
      if (autocomplete) google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [placeIdParam]);

  async function onFile(file: File) {
    setFileError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!isWeaveReport(parsed)) {
        setFileError('That file doesn’t look like a Weave report — export it from the Care Pass.');
        return;
      }
      setReport(parsed);
    } catch {
      setFileError('Could not read that file as JSON.');
    }
  }

  async function onSubmit() {
    if (!report || !building) return;
    setSubmitState('busy');
    setSubmitError(null);
    try {
      await submitReport(building, report, scoreReport(report), note);
      setSubmitState('done');
    } catch (e) {
      setSubmitState('error');
      setSubmitError((e as Error).message);
    }
  }

  const score = report ? scoreReport(report) : null;
  const checks = report ? scoreChecks(report) : [];

  return (
    <div className="upload-page">
      <h1>Add an accessibility report</h1>
      <p className="lede">
        Upload the report a room check produced, pick the building it's for, and it joins that
        building's score in the community search.
      </p>

      {!supabaseConfigured && (
        <div className="banner error">
          Supabase isn't configured, so this can be filled out but not submitted. Set{' '}
          <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code> in{' '}
          <code>community/.env.local</code>.
        </div>
      )}

      <div className="card">
        <h3>1 — The report</h3>
        {report ? (
          <div className="picked-building">
            <span>
              {report.profileName} · {report.roomWidthMm} × {report.roomDepthMm} mm ·{' '}
              {report.passes ? 'passed' : `${report.routes.filter((r) => !r.passes).length} issue(s)`}
            </span>
            <button className="btn-link" onClick={() => setReport(null)}>
              change
            </button>
          </div>
        ) : (
          <label className="dropzone">
            <input
              type="file"
              accept="application/json"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            Click to choose the <code>.json</code> file exported from a Weave Care Pass
          </label>
        )}
        {fileError && <div className="banner error" style={{ marginTop: 10 }}>{fileError}</div>}
      </div>

      {report && (
        <div className="card">
          <h3>2 — Score preview</h3>
          <div className="score-hero">
            <span className="num">{score!.toFixed(1)}</span>
            <span className="of10">/ 10</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {checks.map((c) => (
              <div className="report-check" data-ok={c.score >= 5} key={c.label}>
                <span>{c.label}</span>
                <span className="v">
                  {Math.round(c.measuredMm)} / {Math.round(c.requiredMm)} mm
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3>3 — Which building</h3>
        {!googleMapsConfigured ? (
          <div className="banner error">
            Google Maps isn't configured — set <code>VITE_GOOGLE_MAPS_API_KEY</code> to search for a
            building.
          </div>
        ) : building ? (
          <div className="picked-building">
            <span>
              {building.name}
              {building.address && ` · ${building.address}`}
            </span>
            <button className="btn-link" onClick={() => setBuilding(null)}>
              change
            </button>
          </div>
        ) : (
          <div className="field autocomplete-wrap">
            <input ref={autocompleteInputRef} type="text" placeholder="Search for the building or restaurant…" />
          </div>
        )}
      </div>

      <div className="card">
        <h3>4 — Note (optional)</h3>
        <div className="field">
          <textarea
            placeholder="Anything worth flagging that the numbers don't capture — e.g. “accessible entrance is round the side”"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {submitState === 'done' ? (
        <div className="banner ok">
          Submitted. <button className="btn-link" onClick={goToMap}>Back to the map →</button>
        </div>
      ) : (
        <>
          {submitState === 'error' && <div className="banner error">{submitError}</div>}
          <button
            className="btn primary"
            disabled={!report || !building || submitState === 'busy' || !supabaseConfigured}
            onClick={onSubmit}
          >
            {submitState === 'busy' ? 'Submitting…' : 'Submit to community'}
          </button>
        </>
      )}
    </div>
  );
}
