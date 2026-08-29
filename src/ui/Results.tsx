import type { ClearanceResult, MobilityProfile, Room } from '../types';
import { formatLength, type UnitSystem } from '../units';

interface Props {
  room: Room;
  result: ClearanceResult;
  profile: MobilityProfile;
  units: UnitSystem;
  onOpenPass(): void;
}

export function Results({ room, result, profile, units, onOpenPass }: Props) {
  const label = (id?: string) => room.anchors.find((a) => a.id === id)?.label ?? '—';

  return (
    <div className="results">
      <header>
        <h3>Findings</h3>
        <div className="verdict" data-pass={result.passes}>
          <span className="mark">{result.passes ? '✓' : '!'}</span>
          {result.passes ? 'Clear' : `${result.violations.length} issue${result.violations.length === 1 ? '' : 's'}`}
        </div>
      </header>

      <div className="inner">
        {result.routes.map((r) => (
          <div className="finding" key={`${r.fromAnchorId}-${r.toAnchorId}`} data-ok={r.passes}>
            <div className="bar" />
            <div>
              <div className="head">
                <span>
                  {label(r.fromAnchorId)} → {label(r.toAnchorId)}
                </span>
                <span className="measure">
                  {r.bottleneck > 0 ? formatLength(r.bottleneck, units) : 'blocked'}
                </span>
              </div>
              <p>
                {r.passes
                  ? `Widest continuous route, needs ${formatLength(profile.minPathWidth, units)}.`
                  : r.bottleneck > 0
                    ? 'The best route available narrows here — marked on the plan.'
                    : 'No route exists at all; the destination is enclosed.'}
              </p>
              {!r.passes && r.bottleneck > 0 && (
                <span className="deficit">
                  {formatLength(profile.minPathWidth - r.bottleneck, units)} short
                </span>
              )}
            </div>
          </div>
        ))}

        {result.turningCircle && (
          <div className="finding" data-ok={result.turningCircle.passes}>
            <div className="bar" />
            <div>
              <div className="head">
                <span>Turning space</span>
                <span className="measure">⌀ {formatLength(result.turningCircle.diameter, units)}</span>
              </div>
              <p>
                {result.turningCircle.passes
                  ? `Largest circle within reach, needs ⌀ ${formatLength(profile.turningDiameter, units)}.`
                  : 'Nowhere reachable is big enough to turn around in.'}
              </p>
              {!result.turningCircle.passes && (
                <span className="deficit">
                  {formatLength(profile.turningDiameter - result.turningCircle.diameter, units)} short
                </span>
              )}
            </div>
          </div>
        )}

        {result.routes.length === 0 && (
          <p className="hint">
            Mark an entry point and at least one destination to check routes. Without them only
            turning space can be measured.
          </p>
        )}

        <button className="btn wide primary" style={{ marginTop: 12 }} onClick={onOpenPass}>
          Generate Care Pass
        </button>

        <div className="meta">
          <span>
            {result.computeMs.toFixed(1)} ms · {result.cellSize} mm grid
          </span>
          <span>±{result.cellSize / 2} mm</span>
        </div>
      </div>
    </div>
  );
}
