import { useRef, useState } from 'react';
import type { FurnitureItem, FurnitureType, MobilityProfile, Room } from '../types';
import { FURNITURE } from '../data/furniture';
import { PROFILES } from '../profiles';
import { formatLength, fromMm, parseToMm, unitSuffix, type UnitSystem } from '../units';

interface Props {
  room: Room;
  profile: MobilityProfile;
  units: UnitSystem;
  selectedId: string | null;
  placing: 'entry' | 'destination' | null;
  photoBusy: boolean;
  photoNotes: string[];
  onRoomSize(width: number, depth: number): void;
  onProfile(id: string): void;
  onSelect(id: string | null): void;
  onAdd(type: FurnitureType): void;
  onUpdate(id: string, patch: Partial<FurnitureItem>): void;
  onDelete(id: string): void;
  onStartPlacing(kind: 'entry' | 'destination' | null): void;
  onDeleteAnchor(id: string): void;
  onPhoto(file: File): void;
  onPreset(which: 'demo' | 'empty'): void;
}

const QUICK_ADD: FurnitureType[] = [
  'bed', 'wardrobe', 'dresser', 'nightstand', 'desk', 'chair', 'sofa', 'table', 'bookcase',
];

export function Rail(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [wText, setWText] = useState<string | null>(null);
  const [dText, setDText] = useState<string | null>(null);

  const selected = p.room.furniture.find((f) => f.id === p.selectedId) ?? null;
  const spec = selected ? FURNITURE[selected.type] : null;

  const dimValue = (mm: number, override: string | null) =>
    override ?? String(Math.round(fromMm(mm, p.units)));

  const commit = (which: 'w' | 'd', text: string) => {
    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) return;
    const mm = Math.round(parseToMm(n, p.units));
    const clamped = Math.min(30000, Math.max(500, mm));
    if (which === 'w') p.onRoomSize(clamped, p.room.depth);
    else p.onRoomSize(p.room.width, clamped);
  };

  return (
    <aside className="rail">
      <section className="section">
        <h2>The room</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="rw">Width ({unitSuffix(p.units)})</label>
            <input
              id="rw"
              type="number"
              value={dimValue(p.room.width, wText)}
              onChange={(e) => setWText(e.target.value)}
              onBlur={(e) => { commit('w', e.target.value); setWText(null); }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </div>
          <div className="field">
            <label htmlFor="rd">Depth ({unitSuffix(p.units)})</label>
            <input
              id="rd"
              type="number"
              value={dimValue(p.room.depth, dText)}
              onChange={(e) => setDText(e.target.value)}
              onBlur={(e) => { commit('d', e.target.value); setDText(null); }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </div>
        </div>
        <p className="hint">
          This is the one measurement taken as fact. Everything the photo contributes is scaled
          by it, which is what turns an estimate into millimetres.
        </p>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => p.onPreset('demo')}>Demo room</button>
          <button className="btn" onClick={() => p.onPreset('empty')}>Clear room</button>
        </div>
      </section>

      <section className="section">
        <h2>Who is it for</h2>
        <div className="field">
          <select value={p.profile.id} onChange={(e) => p.onProfile(e.target.value)}>
            {PROFILES.map((pr) => (
              <option key={pr.id} value={pr.id}>{pr.name}</option>
            ))}
          </select>
        </div>
        <div className="source">{p.profile.source}</div>
        {p.profile.note && <p className="hint">{p.profile.note}</p>}
      </section>

      <section className="section">
        <h2>From a photo</h2>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) p.onPhoto(f);
            e.target.value = '';
          }}
        />
        <button
          className="btn wide primary"
          disabled={p.photoBusy}
          onClick={() => fileRef.current?.click()}
        >
          {p.photoBusy ? 'Reading the room…' : 'Take or upload a photo'}
        </button>
        <p className="hint">
          The photo tells us what is in the room and roughly where. It never sets a size —
          sizes come from the standard table below and are yours to correct.
        </p>
        {p.photoNotes.map((n, i) => (
          <p className="hint warn" key={i}>{n}</p>
        ))}
      </section>

      <section className="section">
        <h2>Furniture</h2>
        <div className="items">
          {p.room.furniture.map((f) => (
            <div
              key={f.id}
              className="item"
              data-sel={f.id === p.selectedId}
              onClick={() => p.onSelect(f.id === p.selectedId ? null : f.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && p.onSelect(f.id)}
            >
              <span className="swatch" data-est={f.provenance === 'estimated'} />
              <span className="name">{f.label ?? FURNITURE[f.type].label}</span>
              <span className="dims">
                {formatLength(f.width, p.units)}×{formatLength(f.depth, p.units)}
              </span>
              <button
                className="iconbtn"
                title="Remove"
                onClick={(e) => { e.stopPropagation(); p.onDelete(f.id); }}
              >
                ×
              </button>
            </div>
          ))}
          {p.room.furniture.length === 0 && (
            <p className="hint">Nothing placed yet. Add a piece below, or start from a photo.</p>
          )}
        </div>

        {selected && spec && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--ink-15)' }}>
            <div className="field">
              <label>{spec.label} — size</label>
              {spec.variants ? (
                <div className="chips">
                  {spec.variants.map((v) => (
                    <button
                      key={v.label}
                      className="chip"
                      data-on={selected.width === v.width && selected.depth === v.depth}
                      onClick={() => p.onUpdate(selected.id, { width: v.width, depth: v.depth, provenance: 'user' })}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="hint" style={{ margin: 0 }}>
                  Standard {formatLength(spec.width, p.units)} × {formatLength(spec.depth, p.units)}.
                </p>
              )}
            </div>
            <div className="row">
              <button
                className="btn"
                onClick={() =>
                  p.onUpdate(selected.id, {
                    rotation: (((selected.rotation + 90) % 360) as 0 | 90 | 180 | 270),
                    provenance: 'user',
                  })
                }
              >
                ⟳ Rotate 90°
              </button>
              <button className="btn" onClick={() => p.onDelete(selected.id)}>Remove</button>
            </div>
            {selected.provenance === 'estimated' && (
              <p className="hint warn">
                Position estimated from the photo. Drag it to where it really sits — that
                confirms it.
              </p>
            )}
          </div>
        )}

        <div className="chips" style={{ marginTop: 12 }}>
          {QUICK_ADD.map((t) => (
            <button key={t} className="chip" onClick={() => p.onAdd(t)}>
              + {FURNITURE[t].label}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Points that matter</h2>
        <div className="items">
          {p.room.anchors.map((a) => (
            <div className="item" key={a.id}>
              <span
                className="swatch"
                style={{
                  background: a.kind === 'entry' ? 'var(--ink)' : 'var(--emerald)',
                  borderRadius: a.kind === 'entry' ? 2 : 999,
                  borderColor: a.kind === 'entry' ? 'var(--ink)' : 'var(--emerald)',
                }}
              />
              <span className="name">{a.label}</span>
              <span className="dims">{a.kind === 'entry' ? 'entry' : 'destination'}</span>
              <button className="iconbtn" title="Remove" onClick={() => p.onDeleteAnchor(a.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className={`btn ${p.placing === 'entry' ? 'armed' : ''}`}
            onClick={() => p.onStartPlacing(p.placing === 'entry' ? null : 'entry')}
          >
            {p.placing === 'entry' ? 'Click the plan…' : 'Set entry'}
          </button>
          <button
            className={`btn ${p.placing === 'destination' ? 'armed' : ''}`}
            onClick={() => p.onStartPlacing(p.placing === 'destination' ? null : 'destination')}
          >
            {p.placing === 'destination' ? 'Click the plan…' : 'Add destination'}
          </button>
        </div>
        <p className="hint">
          A room can have plenty of open floor and still fail, if the open floor is not between
          the door and the places someone actually needs to reach.
        </p>
      </section>
    </aside>
  );
}
