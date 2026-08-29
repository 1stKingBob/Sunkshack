import { useCallback, useMemo, useState } from 'react';
import type { AnchorPoint, FurnitureItem, FurnitureType, Room } from './types';
import { checkClearance } from './engine/clearance';
import { applySuggestion, suggestFix, type Suggestion } from './engine/suggest';
import { DEFAULT_PROFILE_ID, getProfile } from './profiles';
import { cloneRoom, DEMO_BEDROOM, EMPTY_ROOM } from './data/demoRooms';
import { FURNITURE, makeItem } from './data/furniture';
import { analysePhotos, fileToDataUrl } from './pipeline/analyze';
import { formatLength, type UnitSystem } from './units';
import { Rail } from './ui/Rail';
import { Results } from './ui/Results';
import { Stage } from './ui/Stage';
import { CarePass, buildReport, encodeReport } from './ui/CarePass';
import { Intro } from './ui/Intro';
import { Menu, type Destination } from './ui/Menu';
import { CommunityApp } from './community/CommunityApp';
import { Method } from './ui/Method';

type View = 'intro' | 'menu' | 'dashboard' | 'community' | 'method';

let anchorSeq = 0;

export default function App() {
  const [view, setView] = useState<View>('intro');
  const [room, setRoom] = useState<Room>(() => cloneRoom(DEMO_BEDROOM));
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE_ID);
  const [units, setUnits] = useState<UnitSystem>('metric');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacing] = useState<'entry' | 'destination' | null>(null);
  const [showChair, setShowChair] = useState(true);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNotes, setPhotoNotes] = useState<string[]>([]);
  const [passOpen, setPassOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const profile = getProfile(profileId);

  // Cheap enough to run synchronously on every render, including every frame
  // of a drag — that is the whole point of the distance-field design.
  const result = useMemo(() => checkClearance(room, profile), [room, profile]);

  /**
   * A suggestion describes a specific room. The moment anything moves, resizes,
   * or the profile changes, it is advice about a layout that no longer exists —
   * so it is cleared rather than left on screen going quietly stale.
   */
  const mutate = useCallback((fn: (r: Room) => Room) => {
    setSuggestion(null);
    setRoom(fn);
  }, []);

  const patchItem = useCallback(
    (id: string, patch: Partial<FurnitureItem>) => {
      mutate((r) => ({
        ...r,
        furniture: r.furniture.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      }));
    },
    [mutate],
  );

  const onMove = useCallback(
    (id: string, x: number, y: number) => {
      mutate((r) => ({
        ...r,
        furniture: r.furniture.map((f) =>
          f.id === id ? { ...f, x, y, provenance: 'user' as const } : f,
        ),
      }));
    },
    [mutate],
  );

  const onAdd = useCallback(
    (type: FurnitureType) => {
      mutate((r) => {
        const item = makeItem(type, r.width / 2, r.depth / 2, 'default');
        const taken = r.furniture.length;
        item.x = Math.min(
          r.width - item.width / 2,
          Math.max(item.width / 2, r.width / 2 + (taken % 3) * 300 - 300),
        );
        item.y = Math.min(
          r.depth - item.depth / 2,
          Math.max(item.depth / 2, r.depth / 2 + Math.floor(taken / 3) * 300 - 300),
        );
        setSelectedId(item.id);
        return { ...r, furniture: [...r.furniture, item] };
      });
    },
    [mutate],
  );

  const onDelete = useCallback(
    (id: string) => {
      mutate((r) => ({ ...r, furniture: r.furniture.filter((f) => f.id !== id) }));
      setSelectedId((s) => (s === id ? null : s));
    },
    [mutate],
  );

  const onRoomSize = useCallback(
    (width: number, depth: number) => {
      mutate((r) => ({
        ...r,
        width,
        depth,
        furniture: r.furniture.map((f) => ({
          ...f,
          x: Math.min(width - f.width / 2, Math.max(f.width / 2, f.x)),
          y: Math.min(depth - f.depth / 2, Math.max(f.depth / 2, f.y)),
        })),
        anchors: r.anchors.map((a) => ({
          ...a,
          x: Math.min(width, Math.max(0, a.x)),
          y: Math.min(depth, Math.max(0, a.y)),
        })),
      }));
    },
    [mutate],
  );

  const onPlacePoint = useCallback(
    (x: number, y: number) => {
      if (!placing) return;
      anchorSeq += 1;
      const next: AnchorPoint = {
        id: `anchor-${anchorSeq}`,
        kind: placing,
        label: placing === 'entry' ? 'Door' : `Destination ${anchorSeq}`,
        x: Math.round(x),
        y: Math.round(y),
      };
      mutate((r) => ({
        ...r,
        anchors:
          placing === 'entry'
            ? [...r.anchors.filter((a) => a.kind !== 'entry'), next]
            : [...r.anchors, next],
      }));
      setPlacing(null);
    },
    [placing, mutate],
  );

  const onPhotos = useCallback(
    async (files: File[]) => {
      setPhotoBusy(true);
      setPhotoNotes([]);
      setSuggestion(null);
      try {
        const urls = await Promise.all(files.slice(0, 4).map((f) => fileToDataUrl(f)));
        const outcome = await analysePhotos(urls, room);
        if (outcome.furniture.length > 0) {
          setRoom((r) => ({ ...r, furniture: outcome.furniture }));
        }
        setPhotoNotes(outcome.warnings);
      } catch (err) {
        setPhotoNotes([`Could not read those images: ${(err as Error).message}`]);
      } finally {
        setPhotoBusy(false);
      }
    },
    [room],
  );

  const onPreset = useCallback(
    (which: 'demo' | 'empty') => {
      setSuggestion(null);
      setRoom(cloneRoom(which === 'demo' ? DEMO_BEDROOM : EMPTY_ROOM));
      setSelectedId(null);
      setPhotoNotes([]);
    },
    [],
  );

  /**
   * The search is bounded but still costs a few hundred milliseconds. Yielding
   * a frame first lets the button paint its busy state, so the UI never looks
   * like it has silently ignored the click.
   */
  const onSuggest = useCallback(() => {
    setSuggesting(true);
    setTimeout(() => {
      try {
        setSuggestion(suggestFix(room, profile));
      } finally {
        setSuggesting(false);
      }
    }, 30);
  }, [room, profile]);

  const onApplySuggestion = useCallback(() => {
    if (!suggestion) return;
    const next = applySuggestion(room, suggestion);
    setSuggestion(null);
    setSelectedId(suggestion.itemId);
    setRoom(next);
  }, [room, suggestion]);

  const go = useCallback((d: Destination) => {
    if (d === 'exit') setView('intro');
    else setView(d);
  }, []);

  if (view === 'intro') return <Intro onDone={() => setView('menu')} />;
  if (view === 'menu') return <Menu onGo={go} />;

  const secondary = view === 'community' || view === 'method';

  return (
    <div className="app">
      <header className="topbar">
        <button className="wordmark wordmark-btn" onClick={() => setView('intro')} title="Back to start">
          <span className="glyph" />
          Weave
        </button>
        <span className="tagline">
          {view === 'community'
            ? 'Places people have measured'
            : view === 'method'
              ? 'Method & standards'
              : 'Connecting the threads that build communities'}
        </span>
        <div className="spacer" />
        <div className="segmented">
          <button data-on={units === 'metric'} onClick={() => setUnits('metric')}>mm</button>
          <button data-on={units === 'imperial'} onClick={() => setUnits('imperial')}>ft / in</button>
        </div>
        {!secondary && (
          <div className="verdict" data-pass={result.passes}>
            <span className="mark">{result.passes ? '✓' : '!'}</span>
            {result.passes ? 'Clear' : 'Blocked'}
          </div>
        )}
        {secondary && (
          <button className="btn" onClick={() => setView('dashboard')}>
            Open dashboard
          </button>
        )}
      </header>

      {view === 'community' && <CommunityApp units={units} />}
      {view === 'method' && <Method units={units} />}

      {view === 'dashboard' && (
        <div className="body">
          <Rail
            room={room}
            profile={profile}
            units={units}
            selectedId={selectedId}
            placing={placing}
            photoBusy={photoBusy}
            photoNotes={photoNotes}
            onRoomSize={onRoomSize}
            onProfile={(id) => {
              setSuggestion(null);
              setProfileId(id);
            }}
            onSelect={setSelectedId}
            onAdd={onAdd}
            onUpdate={patchItem}
            onDelete={onDelete}
            onStartPlacing={setPlacing}
            onDeleteAnchor={(id) =>
              mutate((r) => ({ ...r, anchors: r.anchors.filter((a) => a.id !== id) }))
            }
            onPhotos={onPhotos}
            onPreset={onPreset}
          />

          <main className="stage">
            <Stage
              room={room}
              result={result}
              selectedId={selectedId}
              suggestion={suggestion}
              mode={placing ? (placing === 'entry' ? 'place-entry' : 'place-destination') : 'select'}
              showWheelchair={showChair}
              onSelect={setSelectedId}
              onMove={onMove}
              onPlacePoint={onPlacePoint}
            />

            {placing && (
              <div className="stage-hint">
                Click the plan to place the {placing === 'entry' ? 'entry point' : 'destination'}
              </div>
            )}

            <div className="stage-tools">
              <button className="btn" onClick={() => setShowChair((v) => !v)}>
                {showChair ? 'Hide wheelchair' : 'Show wheelchair'}
              </button>
            </div>

            <div className="legend">
              <div className="lg">
                <span className="key pass" />
                <span>Clear — meets the set figures</span>
              </div>
              <div className="lg">
                <span className="key fail" />
                <span>Hatched — too tight</span>
              </div>
              <div className="lg">
                <span className="key ghost" />
                <span>Dashed — suggested position</span>
              </div>
            </div>

            <Results
              room={room}
              result={result}
              profile={profile}
              units={units}
              suggestion={suggestion}
              suggesting={suggesting}
              onSuggest={onSuggest}
              onApplySuggestion={onApplySuggestion}
              onDismissSuggestion={() => setSuggestion(null)}
              onOpenPass={() => setPassOpen(true)}
              describeItem={(id) => {
                const f = room.furniture.find((x) => x.id === id);
                return f ? (f.label ?? FURNITURE[f.type].label) : 'the item';
              }}
              formatLength={(mm) => formatLength(mm, units)}
            />
          </main>
        </div>
      )}

      {passOpen && (
        <CarePass
          room={room}
          result={result}
          profile={profile}
          units={units}
          onClose={() => setPassOpen(false)}
          onPublish={() => {
            // Hand the finished check to the Community screen through the URL
            // fragment its upload page already reads, so the two halves stay
            // decoupled — Community accepts a report, not this app's state.
            window.location.hash = `/upload?report=${encodeURIComponent(
              encodeReport(buildReport(room, result, profile)),
            )}`;
            setPassOpen(false);
            setView('community');
          }}
        />
      )}
    </div>
  );
}
