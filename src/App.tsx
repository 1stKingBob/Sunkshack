import { useCallback, useMemo, useState } from 'react';
import type { AnchorPoint, FurnitureItem, FurnitureType, Room } from './types';
import { checkClearance } from './engine/clearance';
import { DEFAULT_PROFILE_ID, getProfile } from './profiles';
import { cloneRoom, DEMO_BEDROOM, EMPTY_ROOM } from './data/demoRooms';
import { makeItem } from './data/furniture';
import { analysePhoto, fileToDataUrl } from './pipeline/analyze';
import type { UnitSystem } from './units';
import { Rail } from './ui/Rail';
import { Results } from './ui/Results';
import { Stage } from './ui/Stage';
import { CarePass } from './ui/CarePass';

let anchorSeq = 0;

export default function App() {
  const [room, setRoom] = useState<Room>(() => cloneRoom(DEMO_BEDROOM));
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE_ID);
  const [units, setUnits] = useState<UnitSystem>('metric');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [placing, setPlacing] = useState<'entry' | 'destination' | null>(null);
  const [showChair, setShowChair] = useState(true);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNotes, setPhotoNotes] = useState<string[]>([]);
  const [passOpen, setPassOpen] = useState(false);

  const profile = getProfile(profileId);

  // The whole point of the distance-field design: this is cheap enough to run
  // synchronously on every render, including every frame of a drag.
  const result = useMemo(() => checkClearance(room, profile), [room, profile]);

  const patchItem = useCallback((id: string, patch: Partial<FurnitureItem>) => {
    setRoom((r) => ({
      ...r,
      furniture: r.furniture.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }, []);

  const onMove = useCallback(
    (id: string, x: number, y: number) => {
      setRoom((r) => ({
        ...r,
        furniture: r.furniture.map((f) =>
          f.id === id ? { ...f, x, y, provenance: 'user' as const } : f,
        ),
      }));
    },
    [],
  );

  const onAdd = useCallback((type: FurnitureType) => {
    setRoom((r) => {
      const item = makeItem(type, r.width / 2, r.depth / 2, 'default');
      // drop it somewhere visible rather than exactly on top of whatever is
      // already in the middle
      const taken = r.furniture.length;
      item.x = Math.min(r.width - item.width / 2, Math.max(item.width / 2, r.width / 2 + (taken % 3) * 300 - 300));
      item.y = Math.min(r.depth - item.depth / 2, Math.max(item.depth / 2, r.depth / 2 + Math.floor(taken / 3) * 300 - 300));
      setSelectedId(item.id);
      return { ...r, furniture: [...r.furniture, item] };
    });
  }, []);

  const onDelete = useCallback((id: string) => {
    setRoom((r) => ({ ...r, furniture: r.furniture.filter((f) => f.id !== id) }));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const onRoomSize = useCallback((width: number, depth: number) => {
    setRoom((r) => ({
      ...r,
      width,
      depth,
      // keep everything inside the new shell rather than silently losing it
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
  }, []);

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
      setRoom((r) => ({
        ...r,
        // exactly one entry — a room has one way you come in for this check
        anchors: placing === 'entry' ? [...r.anchors.filter((a) => a.kind !== 'entry'), next] : [...r.anchors, next],
      }));
      setPlacing(null);
    },
    [placing],
  );

  const onPhoto = useCallback(
    async (file: File) => {
      setPhotoBusy(true);
      setPhotoNotes([]);
      try {
        const dataUrl = await fileToDataUrl(file);
        const outcome = await analysePhoto(dataUrl, room);
        if (outcome.furniture.length > 0) {
          setRoom((r) => ({ ...r, furniture: outcome.furniture }));
        }
        setPhotoNotes(outcome.warnings);
      } catch (err) {
        setPhotoNotes([`Could not read that image: ${(err as Error).message}`]);
      } finally {
        setPhotoBusy(false);
      }
    },
    [room],
  );

  const onPreset = useCallback((which: 'demo' | 'empty') => {
    setRoom(cloneRoom(which === 'demo' ? DEMO_BEDROOM : EMPTY_ROOM));
    setSelectedId(null);
    setPhotoNotes([]);
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="wordmark">
          <span className="glyph" />
          Weave
        </div>
        <span className="tagline">Does this room actually work for the person in it?</span>
        <div className="spacer" />
        <div className="segmented">
          <button data-on={units === 'metric'} onClick={() => setUnits('metric')}>mm</button>
          <button data-on={units === 'imperial'} onClick={() => setUnits('imperial')}>ft / in</button>
        </div>
        <div className="verdict" data-pass={result.passes}>
          <span className="mark">{result.passes ? '✓' : '!'}</span>
          {result.passes ? 'Clear' : 'Blocked'}
        </div>
      </header>

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
          onProfile={setProfileId}
          onSelect={setSelectedId}
          onAdd={onAdd}
          onUpdate={patchItem}
          onDelete={onDelete}
          onStartPlacing={setPlacing}
          onDeleteAnchor={(id) =>
            setRoom((r) => ({ ...r, anchors: r.anchors.filter((a) => a.id !== id) }))
          }
          onPhoto={onPhoto}
          onPreset={onPreset}
        />

        <main className="stage">
          <Stage
            room={room}
            result={result}
            selectedId={selectedId}
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
            <div className="lg" style={{ color: 'var(--ink-60)', marginTop: 2 }}>
              Drag furniture to test a change
            </div>
          </div>

          <Results
            room={room}
            result={result}
            profile={profile}
            units={units}
            onOpenPass={() => setPassOpen(true)}
          />
        </main>
      </div>

      {passOpen && (
        <CarePass
          room={room}
          result={result}
          profile={profile}
          units={units}
          onClose={() => setPassOpen(false)}
        />
      )}
    </div>
  );
}
