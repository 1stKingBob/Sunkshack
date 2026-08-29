import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, googleMapsConfigured } from '../lib/googleMaps';
import { submitReport, supabaseConfigured } from '../lib/supabase';
import { ACCESS_MARGIN_MM, isAccessible, scoreChecks } from '../lib/score';
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

/** Places API (New) → Building, the shared field set every lookup below fetches. */
function placeToBuilding(place: google.maps.places.Place): Building | null {
  if (!place.id || !place.location) return null;
  return {
    placeId: place.id,
    name: place.displayName ?? 'Unnamed place',
    address: place.formattedAddress ?? null,
    lat: place.location.lat(),
    lng: place.location.lng(),
    category: place.types?.[0]?.replace(/_/g, ' ') ?? null,
  };
}

const PLACE_FIELDS = ['id', 'displayName', 'formattedAddress', 'location', 'types'];

export function UploadPage({ placeIdParam, reportParam }: Props) {
  const [report, setReport] = useState<WeaveReport | null>(() => decodeReportParam(reportParam));
  const [fileError, setFileError] = useState<string | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [note, setNote] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const placesLibRef = useRef<google.maps.PlacesLibrary | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Places API (New) — the legacy `Autocomplete` widget and `PlacesService` this
  // used to call are frozen for any Cloud project made after 1 March 2025, so a
  // fresh key gets "This API project is not authorized" the instant either
  // fires. `AutocompleteSuggestion` + `Place` are their (New) replacements — see
  // ../lib/placesSearch.ts, which hit the same wall for the map's search box.
  useEffect(() => {
    if (!googleMapsConfigured) return;
    let cancelled = false;
    loadGoogleMaps().then(async (g) => {
      const places = (await g.maps.importLibrary('places')) as google.maps.PlacesLibrary;
      if (cancelled) return;
      placesLibRef.current = places;
      sessionTokenRef.current = new places.AutocompleteSessionToken();

      // Arrived from a building's "Add report" button — look the place up directly.
      if (placeIdParam) {
        const place = new places.Place({ id: placeIdParam });
        place
          .fetchFields({ fields: PLACE_FIELDS })
          .then(() => {
            if (cancelled) return;
            const b = placeToBuilding(place);
            if (b) setBuilding(b);
          })
          .catch(() => {
            if (!cancelled) setSearchError('Could not load that place — try searching for it below.');
          });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [placeIdParam]);

  // Debounced suggestion fetch as the user types.
  useEffect(() => {
    const places = placesLibRef.current;
    if (!places || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { suggestions: results } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: sessionTokenRef.current ?? undefined,
        });
        if (!cancelled) setSuggestions(results);
      } catch (e) {
        if (!cancelled) {
          setSuggestions([]);
          setSearchError((e as Error).message);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function pickSuggestion(s: google.maps.places.AutocompleteSuggestion) {
    const prediction = s.placePrediction;
    if (!prediction) return;
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: PLACE_FIELDS });
      const b = placeToBuilding(place);
      if (b) setBuilding(b);
    } catch (e) {
      setSearchError((e as Error).message);
      return;
    }
    setSuggestions([]);
    setQuery('');
    // A session ends once fetchFields is called on a selection — start a fresh
    // one for the next search so billing groups each pick as its own session.
    const places = placesLibRef.current;
    if (places) sessionTokenRef.current = new places.AutocompleteSessionToken();
  }

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
      await submitReport(building, report, isAccessible(report), note);
      setSubmitState('done');
    } catch (e) {
      setSubmitState('error');
      setSubmitError((e as Error).message);
    }
  }

  const accessible = report ? isAccessible(report) : null;
  const checks = report ? scoreChecks(report) : [];

  return (
    <div className="upload-page">
      <button className="btn-link back-to-map" onClick={goToMap}>
        ← Back to the map
      </button>
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
          <h3>2 — Accessibility preview</h3>
          <div className="access-hero" data-ok={accessible}>
            {accessible ? 'Accessible' : 'Not accessible'}
          </div>
          <p style={{ color: 'var(--ink-60)', fontSize: 12.5, marginTop: 6 }}>
            Every route and the turning space need at least {ACCESS_MARGIN_MM} mm to spare over the
            AS 1428.1 / ADA minimum — meeting the figure exactly isn't enough.
          </p>
          <div style={{ marginTop: 12 }}>
            {checks.map((c) => (
              <div className="report-check" data-ok={c.clearsMargin} key={c.label}>
                <span>{c.label}</span>
                <span className="v">
                  {Math.round(c.measuredMm)} / {Math.round(c.requiredMm)} mm
                  {c.passes && !c.clearsMargin ? ' · meets minimum, no margin' : ''}
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
            <input
              type="text"
              placeholder="Search for the building or restaurant…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchError(null);
              }}
            />
            {suggestions.length > 0 && (
              <div className="autocomplete-list">
                {suggestions.map((s, i) => (
                  <div
                    className="autocomplete-item"
                    key={s.placePrediction?.placeId ?? i}
                    onClick={() => pickSuggestion(s)}
                  >
                    {s.placePrediction?.text.text ?? ''}
                  </div>
                ))}
              </div>
            )}
            {searchError && <div className="banner error" style={{ marginTop: 10 }}>{searchError}</div>}
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
