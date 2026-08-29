import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface Props {
  /** -1 or 1 — mirrors the sweep of the path family */
  position: number;
  /** how many strokes in the family */
  count?: number;
  /** base stroke colour */
  color?: string;
  /** multiplier on the whole layer's opacity */
  intensity?: number;
  className?: string;
}

/**
 * Long curved strokes that draw themselves in, then drift.
 *
 * WHY THIS IS NOT A STRAIGHT PORT OF THE ORIGINAL
 * ───────────────────────────────────────────────
 * The original animates `pathOffset` forever. Framer compiles that to
 * `stroke-dashoffset`, which is a paint-level property: every frame the
 * browser re-rasterises the entire stroke on the CPU, with no compositor
 * involvement. That is affordable on a small hero panel. Full-screen it is
 * not — `preserveAspectRatio="slice"` scales this path family until each
 * stroke has a bounding box of roughly 2600 × 3165 px, and repainting two
 * dozen of those every frame measured at **0.6 fps**. Swapping animation
 * libraries changes nothing, because both libraries set the same property.
 *
 * So the motion is split in two, by cost:
 *
 *   • The draw-in — `pathLength` 0 → 1, staggered — runs ONCE on mount. It is
 *     the expensive kind of animation, and it is over in a couple of seconds.
 *   • The perpetual drift is a `transform` on the single <svg> element.
 *     Transforms are composited on the GPU: the field is rasterised once and
 *     then moved, which costs essentially nothing however large it is.
 *
 * The result reads the same — lines sweeping in and then slowly travelling —
 * and holds 60 fps instead of grinding.
 *
 * Reduced motion is honoured: strokes appear, nothing moves. A background in
 * perpetual motion is a genuine problem for vestibular sensitivity, and
 * shipping one unconditionally in an accessibility tool would be a poor joke.
 */
export function FloatingPaths({
  position,
  count = 36,
  color = 'rgba(255, 255, 255, 0.9)',
  intensity = 1,
  className,
}: Props) {
  const reduced = useReducedMotion();

  const paths = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        d:
          `M-${380 - i * 5 * position} -${189 + i * 9}` +
          `C-${380 - i * 5 * position} -${189 + i * 9} -${312 - i * 5 * position} ${216 - i * 9} ` +
          `${152 - i * 5 * position} ${343 - i * 9}` +
          `C${616 - i * 5 * position} ${470 - i * 9} ${684 - i * 5 * position} ${875 - i * 9} ` +
          `${684 - i * 5 * position} ${875 - i * 9}`,
        width: 0.45 + i * 0.03,
        // Capped: the original ramp reached ~1.0 at 36 strokes, which on a
        // black ground reads as a foreground graphic rather than a backdrop.
        opacity: Math.min(0.5, 0.05 + i * 0.013) * intensity,
        delay: i * 0.04,
      })),
    [position, count, intensity],
  );

  return (
    <div className={`paths-layer${className ? ` ${className}` : ''}`} aria-hidden="true">
      <svg
        className={reduced ? 'paths' : 'paths paths-drift'}
        viewBox="0 0 696 316"
        fill="none"
        // The viewBox is 2.2:1 and a browser window is nearer 1.6:1. Under
        // `slice` the family gets cropped to a sliver in one corner; under
        // `meet` it letterboxes into a band. `none` stretches it to fill the
        // frame, which for abstract curves costs nothing and is what the
        // effect is actually for.
        preserveAspectRatio="none"
        shapeRendering="geometricPrecision"
      >
        {paths.map((p) => (
          <motion.path
            key={p.id}
            d={p.d}
            stroke={color}
            strokeWidth={p.width}
            strokeOpacity={p.opacity}
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 2.6, delay: p.delay, ease: [0.22, 0.75, 0.2, 1] }
            }
          />
        ))}
      </svg>
    </div>
  );
}
