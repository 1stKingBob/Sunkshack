import React from 'react';
import { motion } from 'motion/react';

/**
 * FloatingPathsBackground — used verbatim as supplied.
 *
 * The only substitutions are the `cn` helper and the four Tailwind utilities
 * (`w-full relative`, `absolute inset-0 pointer-events-none`, `w-full h-full`,
 * `text-slate-950 dark:text-white`), reproduced one-for-one in styles.css as
 * .fp-* classes. Installing Tailwind for four rules would drop its preflight
 * reset over a stylesheet already tuned against it and restyle every screen.
 *
 * Everything else is unchanged: 36 paths, the path formula, stroke widths and
 * opacities, pathLength/pathOffset looping forever on a 20–30 s linear cycle,
 * and the default preserveAspectRatio.
 */
export function FloatingPathsBackground({
  position,
  children,
  className,
  /**
   * Defaults to 36, exactly as supplied. It is a prop because the cost of this
   * effect is linear in the number of paths and independent of their size:
   * measured full-screen, 36 paths ran at 6 fps, 12 at 12 fps, 4 at 29 fps,
   * none at 60. Each animated path re-rasterises its whole stroke every frame
   * on the CPU, because stroke-dashoffset is a paint property.
   *
   * The original demo lives in a small aspect-16/9 panel where 36 is fine.
   * Full-bleed it is not, and anything drawn on top gets starved of frames —
   * which is what made the menu options flicker and disappear.
   */
  count = 36,
}: {
  position: number;
  className?: string;
  children?: React.ReactNode;
  count?: number;
}) {
  const paths = Array.from({ length: count }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    color: `rgba(15,23,42,${0.1 + i * 0.03})`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className={`fp-root${className ? ` ${className}` : ''}`}>
      <div className="fp-layer">
        <svg className="fp-svg" viewBox="0 0 696 316" fill="none">
          {paths.map((path) => (
            <motion.path
              key={path.id}
              d={path.d}
              stroke="currentColor"
              strokeWidth={path.width}
              strokeOpacity={0.1 + path.id * 0.03}
              initial={{ pathLength: 0.3, opacity: 0.6 }}
              animate={{
                pathLength: 1,
                opacity: [0.3, 0.6, 0.3],
                pathOffset: [0, 1, 0],
              }}
              transition={{
                duration: 20 + Math.random() * 10,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'linear',
              }}
            />
          ))}
        </svg>
      </div>
      {children}
    </div>
  );
}
