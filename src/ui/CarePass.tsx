import type { ClearanceResult, MobilityProfile, Room } from '../types';
import type { WeaveReport } from '../community/types';
import { formatLength, type UnitSystem } from '../units';
import { FURNITURE } from '../data/furniture';

/**
 * Turn a finished check into the portable report the Community screen accepts.
 *
 * This is deliberately a plain, versioned JSON object rather than a shared
 * type import: it crosses a boundary — it can be saved to a file, pasted, or
 * carried in a URL — so it has to survive independently of this codebase's
 * internals. `weaveReport: 1` is the version marker the reader checks.
 *
 * Note what is NOT in here: no furniture positions, no room photo, no address.
 * Publishing a clearance summary should not mean publishing a floor plan of
 * where someone sleeps.
 */
export function buildReport(
  room: Room,
  result: ClearanceResult,
  profile: MobilityProfile,
): WeaveReport {
  return {
    weaveReport: 1,
    generatedAt: new Date().toISOString(),
    profileId: profile.id,
    profileName: profile.name,
    profileSource: profile.source,
    roomWidthMm: room.width,
    roomDepthMm: room.depth,
    routes: result.routes.map((r) => ({
      label: `${room.anchors.find((a) => a.id === r.fromAnchorId)?.label ?? 'Entry'} → ${
        room.anchors.find((a) => a.id === r.toAnchorId)?.label ?? 'Destination'
      }`,
      measuredMm: Math.round(r.bottleneck),
      requiredMm: profile.minPathWidth,
      passes: r.passes,
    })),
    turning: result.turningCircle
      ? {
          diameterMm: Math.round(result.turningCircle.diameter),
          requiredMm: profile.turningDiameter,
          passes: result.turningCircle.passes,
        }
      : null,
    passes: result.passes,
    furnitureCount: room.furniture.length,
  };
}

/** base64 of the UTF-8 JSON, safe to carry in a URL fragment. */
export function encodeReport(report: WeaveReport): string {
  const json = JSON.stringify(report);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

interface Props {
  room: Room;
  result: ClearanceResult;
  profile: MobilityProfile;
  units: UnitSystem;
  onClose(): void;
  onPublish?(): void;
}

/**
 * The Care Pass.
 *
 * The theme is blocks that make up the world, and the block this addresses is
 * the gap between two people who each hold half the picture: the person who
 * will live in the room and knows how they move through it, and the family
 * member or occupational therapist arranging the furniture who does not. One
 * of them cannot easily check the room; the other cannot easily know what
 * "enough space" feels like. This is the shared, objective artefact between
 * them — a single page they can both point at.
 */
export function CarePass({ room, result, profile, units, onClose, onPublish }: Props) {
  const now = new Date();
  const routeLines = result.routes.map((r) => {
    const from = room.anchors.find((a) => a.id === r.fromAnchorId)?.label ?? 'Entry';
    const to = room.anchors.find((a) => a.id === r.toAnchorId)?.label ?? 'Destination';
    return { label: `${from} → ${to}`, value: r.bottleneck, ok: r.passes };
  });

  return (
    <div className="sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="pass-doc">
          <div className="rule" />
          <div className="kicker">Weave · Room clearance summary</div>
          <h1>Care Pass</h1>
          <p className="sub">
            Prepared {now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} ·{' '}
            {now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </p>

          <dl className="pass-grid">
            <div>
              <dt>Profile checked</dt>
              <dd style={{ fontSize: 13 }}>{profile.name}</dd>
            </div>
            <div>
              <dt>Room</dt>
              <dd>
                {formatLength(room.width, units)} × {formatLength(room.depth, units)}
              </dd>
            </div>
            <div>
              <dt>Route minimum</dt>
              <dd>{formatLength(profile.minPathWidth, units)}</dd>
            </div>
            <div>
              <dt>Turning space</dt>
              <dd>⌀ {formatLength(profile.turningDiameter, units)}</dd>
            </div>
          </dl>

          <div
            className="verdict"
            data-pass={result.passes}
            style={{ fontSize: 13, padding: '8px 16px 8px 12px' }}
          >
            <span className="mark">{result.passes ? '✓' : '!'}</span>
            {result.passes
              ? 'Meets the clearance settings defined below'
              : `${result.violations.length} issue${result.violations.length === 1 ? '' : 's'} to resolve`}
          </div>

          <h4>Routes checked</h4>
          {routeLines.length === 0 && (
            <p className="hint">No routes were checked — no entry and destination were marked.</p>
          )}
          {routeLines.map((r) => (
            <div className="pass-line" key={r.label} data-ok={r.ok}>
              <span>{r.label}</span>
              <span className="v">
                {r.value > 0 ? formatLength(r.value, units) : 'no route'}
                {r.ok ? '  ✓' : '  ✗'}
              </span>
            </div>
          ))}

          <h4>Turning space</h4>
          <div className="pass-line" data-ok={result.turningCircle?.passes ?? false}>
            <span>Largest turning circle within reach</span>
            <span className="v">
              {result.turningCircle ? `⌀ ${formatLength(result.turningCircle.diameter, units)}` : '—'}
              {result.turningCircle?.passes ? '  ✓' : '  ✗'}
            </span>
          </div>

          <h4>Furniture in this layout</h4>
          {room.furniture.map((f) => (
            <div className="pass-line" key={f.id} data-ok={true}>
              <span>
                {f.label ?? FURNITURE[f.type].label}
                {f.provenance === 'estimated' && (
                  <span style={{ color: 'var(--ink-40)', fontSize: 11 }}> · position estimated</span>
                )}
              </span>
              <span className="v" style={{ color: 'var(--ink-60)' }}>
                {formatLength(f.width, units)} × {formatLength(f.depth, units)}
              </span>
            </div>
          ))}

          <div className="disclaimer">
            <strong>What this is and is not.</strong> Weave checks the layout above against the
            clearance figures shown on this page — the ones selected for this check. It is not a
            certification, and it is not a full accessibility assessment: it does not look at
            doorway hardware, floor surfaces, thresholds, lighting, reach ranges, or anything
            outside this room. Reference figures are drawn from {profile.source}. Positions marked
            “estimated” were derived from a photograph and scaled by the room width entered by
            hand; confirm them against the real room before relying on this.
          </div>
        </div>

        <div className="sheet-actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
          <button
            className="btn"
            onClick={() => {
              const report = buildReport(room, result, profile);
              const blob = new Blob([JSON.stringify(report, null, 2)], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `weave-report-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download report
          </button>
          {onPublish && (
            <button className="btn" onClick={onPublish}>
              Publish to Community →
            </button>
          )}
          <button className="btn primary" onClick={() => window.print()}>
            Print / save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
