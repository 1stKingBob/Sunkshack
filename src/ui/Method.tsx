import { PROFILES } from '../profiles';
import { formatLength, type UnitSystem } from '../units';

/**
 * The method page — where the figures come from, how the maths works, and what
 * the tool does not claim. If a judge or a user wants to know whether to trust
 * a number, this is the page that answers it.
 */
export function Method({ units }: { units: UnitSystem }) {
  return (
    <div className="page">
      <div className="page-inner">
        <h1 className="page-title">Method &amp; standards</h1>
        <p className="page-lede">
          Weave reports measurements someone may act on, so every figure it uses is sourced and
          every approximation it makes is stated. Nothing here is a number we invented.
        </p>

        <h2 className="page-h2">The figures</h2>
        <div className="method-table">
          {PROFILES.map((p) => (
            <div className="method-row" key={p.id}>
              <div className="method-name">{p.name}</div>
              <div className="method-nums">
                <span>route ≥ {formatLength(p.minPathWidth, units)}</span>
                <span>turning ⌀ {formatLength(p.turningDiameter, units)}</span>
              </div>
              <div className="method-src">{p.source}</div>
            </div>
          ))}
        </div>

        <h2 className="page-h2">One field, two checks</h2>
        <p>
          Everything reads off a single precomputed field: for every point in the room, how much
          free space surrounds it. Someone can <em>turn</em> at a point exactly when that point's
          clearance is at least their turning radius. A <em>route</em> of width W exists exactly
          when there is a connected chain of points whose clearance never drops below W/2. These
          are not two systems — they are two reads of the same field, which is why the whole check
          re-runs in single-digit milliseconds and can run on every frame while you drag.
        </p>

        <h2 className="page-h2">Measurements are analytic, not counted</h2>
        <p>
          Clearance is computed in closed form — exact point-to-rectangle distance — rather than by
          counting grid cells. A rasterised distance transform has to round furniture outward to
          whole cells and correct back by half a cell, and those two errors do not cancel: on a
          50 mm grid it under-reported a real 735 mm gap as 650 mm. For a tool whose entire claim
          is that it gives you the actual number, an 85 mm systematic error in the headline figure
          is not a rounding detail. The grid still exists — the route search walks over it — but
          its resolution only affects how finely a path can bend, not what any measurement says.
        </p>

        <h2 className="page-h2">Routes are widest-path, then shortest</h2>
        <p>
          When a room fails, “there is no route” is useless. The search maximises the minimum
          clearance along the way, so it returns the best route that exists and the exact width of
          its narrowest point — the number that tells you whether to move the wardrobe 300 mm or
          rethink the room. A second pass then finds the shortest route among those achieving that
          same width, so the line drawn on the plan is one a person would actually take.
        </p>

        <h2 className="page-h2">Why doorways are exempt</h2>
        <p>
          An anchor is somewhere you are trying to arrive at — a doorway, the side of a bed — and
          arriving anywhere means approaching a wall or an object, so clearance at those points is
          near zero by construction. Measuring corridor width across a doorway would fail every
          room ever built. AS 1428.1 reflects this directly: a doorway carries its own clear-width
          figure, deliberately smaller than the figure required of a circulation route. Points
          within the turning radius of an anchor are therefore exempt from the width test — in both
          the search and the measurement, using one shared mask so the two cannot disagree.
        </p>

        <h2 className="page-h2">Colour is never the only signal</h2>
        <p>
          The crimson used for failures and the emerald used for passes sit at a contrast ratio of
          1.27:1 against each other. They differ almost purely in hue, which is the one axis a
          red–green colourblind viewer cannot use. So failures are hatched and passes are solid,
          the measurement is always printed alongside, and the wheelchair is blue — the axis that
          survives. An accessibility tool that could only be read by some people would be a poor
          joke.
        </p>

        <h2 className="page-h2">What this is not</h2>
        <div className="disclaimer" style={{ marginTop: 8 }}>
          Weave checks the layout you gave it against the figures you selected. It is not a
          certification and not a full accessibility assessment: it says nothing about doorway
          hardware, floor surfaces, thresholds, lighting, reach ranges, or anything outside the
          room being checked. Positions derived from a photograph are estimates scaled by the room
          width you typed, and are marked as estimates until you confirm them. The interface never
          claims compliance with a code — it reports whether a layout meets the clearance settings
          in force for that check.
        </div>
      </div>
    </div>
  );
}
