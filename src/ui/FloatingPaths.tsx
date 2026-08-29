import { useMemo } from 'react';

interface Props {
  /** -1 or 1 — mirrors the sweep of the path family */
  position: number;
  /** how many strokes in the family */
  count?: number;
  /** base stroke colour; per-path opacity is layered on top */
  color?: string;
  /** multiplier on the whole layer's opacity */
  intensity?: number;
  className?: string;
}

/**
 * Long curved strokes drifting slowly across the background.
 *
 * Ported from a Framer Motion original. Two things changed and both were
 * deliberate:
 *
 * 1. No animation library. The original animates `pathLength`, `pathOffset`
 *    and opacity — which is precisely what SVG stroke-dash animation already
 *    does. Setting `pathLength="1"` normalises every path to a length of 1
 *    regardless of its real geometry, so a dash pattern and a moving
 *    dash-offset produce the same travelling stroke in pure CSS. Pulling in
 *    ~50 KB of runtime to move a dash offset would be a poor trade for a
 *    background.
 *
 * 2. `preserveAspectRatio="slice"`. The path coordinates run from about −380
 *    to 684 while the viewBox is 696 wide, so the family deliberately
 *    overflows. Under the default `meet` the whole thing letterboxes and sits
 *    in a band; `slice` lets it bleed off the edges as intended.
 *
 * Reduced motion is honoured. A perpetually moving background is exactly the
 * kind of thing that causes trouble for people with vestibular sensitivity,
 * and shipping one unconditionally in an accessibility tool would be a poor
 * joke — under `prefers-reduced-motion` the strokes render, and hold still.
 */
export function FloatingPaths({
  position,
  count = 30,
  color = 'rgba(255, 255, 255, 0.85)',
  intensity = 1,
  className,
}: Props) {
  const paths = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        d:
          `M-${380 - i * 5 * position} -${189 + i * 6}` +
          `C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ` +
          `${152 - i * 5 * position} ${343 - i * 6}` +
          `C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ` +
          `${684 - i * 5 * position} ${875 - i * 6}`,
        width: 0.5 + i * 0.03,
        opacity: (0.08 + i * 0.02) * intensity,
        // Deterministic per-path variation. Math.random() here would reshuffle
        // on every React re-render and make the whole field twitch.
        duration: 22 + ((i * 7) % 13),
        delay: -((i * 3) % 17),
      })),
    [position, count, intensity],
  );

  return (
    <svg
      className={`paths${className ? ` ${className}` : ''}`}
      viewBox="0 0 696 316"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          stroke={color}
          strokeWidth={p.width}
          pathLength={1}
          style={
            {
              '--path-opacity': p.opacity,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </svg>
  );
}
