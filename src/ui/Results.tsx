import type { ClearanceResult, MobilityProfile, Room } from '../types';
import type { Suggestion } from '../engine/suggest';
import { formatLength, type UnitSystem } from '../units';

interface Props {
  room: Room;
  result: ClearanceResult;
  profile: MobilityProfile;
  units: UnitSystem;
  suggestion: Suggestion | null;
  suggesting: boolean;
  onSuggest(): void;
  onApplySuggestion(): void;
  onDismissSuggestion(): void;
  onOpenPass(): void;
  describeItem(id: string): string;
  formatLength(mm: number): string;
}

export function Results({
  room,
  result,
  profile,
  units,
  suggestion,
  suggesting,
  onSuggest,
  onApplySuggestion,
  onDismissSuggestion,
  onOpenPass,
  describeItem,
}: Props) {
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

        {!result.passes && !suggestion && (
          <button
            className="btn wide primary"
            style={{ marginTop: 12 }}
            disabled={suggesting}
            onClick={onSuggest}
          >
            {suggesting ? 'Working out a fix…' : 'Suggest a fix'}
          </button>
        )}

        {suggestion && (
          <div className="suggestion" data-solves={suggestion.solves}>
            <h4>{suggestion.solves ? 'This clears the room' : 'Closest we found'}</h4>
            <p>
              Move the <strong>{describeItem(suggestion.itemId)}</strong> about{' '}
              <strong>{formatLength(suggestion.distance, units)}</strong>
              {suggestion.to.rotation !== suggestion.from.rotation && ' and turn it 90°'}. The
              dashed outline on the plan is where it would go.
            </p>
            <div className="sug-figures">
              <span className="was">{formatLength(suggestion.originalBottleneck, units)}</span>
              <span className="arrow">→</span>
              <span className="now">
                {Number.isFinite(suggestion.resultingBottleneck)
                  ? formatLength(suggestion.resultingBottleneck, units)
                  : '—'}
              </span>
              <span className="need">needs {formatLength(profile.minPathWidth, units)}</span>
            </div>
            {!suggestion.solves && (
              <p className="hint warn" style={{ marginTop: 6 }}>
                Nothing we tried fully clears it — this room may need a smaller piece of
                furniture rather than a different arrangement.
              </p>
            )}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" onClick={onApplySuggestion}>
                Apply
              </button>
              <button className="btn" onClick={onDismissSuggestion}>
                Dismiss
              </button>
            </div>
            <div className="meta" style={{ marginTop: 8 }}>
              <span>
                {suggestion.evaluations} layouts tested · {suggestion.ms.toFixed(0)} ms
              </span>
            </div>
          </div>
        )}

        <button className="btn wide" style={{ marginTop: 10 }} onClick={onOpenPass}>
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
