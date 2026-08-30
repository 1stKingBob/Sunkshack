import { motion } from 'motion/react';

/**
 * MenuFlow — a bundle of animated lines sweeping from low-centre up to the
 * top-right corner, for the empty right side of the menu screen.
 *
 * Not FloatingPathsBackground: that component's curve is a fixed, hardcoded
 * shape authored for a small aspect-16/9 demo panel, and reshaping it to a
 * specific sweep meant fighting its geometry through SVG fit modes and CSS
 * transforms — preserveAspectRatio="none" got close, but a further vertical
 * scale needed to reach the top of the screen visibly bent the curve instead
 * of just repositioning it, non-uniform scaling distorts a bezier's
 * curvature, not just its extent. Authoring the curve to already sweep the
 * intended path sidesteps that entirely.
 *
 * Same rendering technique as FloatingPathsBackground otherwise, and reuses
 * its .fp-* CSS classes: pathLength/pathOffset looping per path, and the
 * layer painted at 40% resolution then upscaled on the GPU, which is what
 * keeps this affordable next to the wheel's own animation loop (see
 * .fp-layer in styles.css, and the flicker history in Menu.tsx).
 */
export function MenuFlow({ count = 8 }: { count?: number }) {
  const paths = Array.from({ length: count }, (_, i) => {
    const dx = i * 16;
    const dy = i * 4;
    return {
      id: i,
      d: `M${430 - dx} ${970 - dy} C${430 - dx} ${650 - dy} ${480 - dx} ${280 - dy} ${665 - dx} ${60 - dy}`,
      strokeOpacity: Math.min(1, 0.32 + i * 0.07),
      strokeWidth: 1 + i * 0.12,
    };
  });

  return (
    <div className="fp-root">
      <div className="fp-layer">
        <svg className="fp-svg" viewBox="0 0 700 1000" preserveAspectRatio="none" fill="none">
          {paths.map((path) => (
            <motion.path
              key={path.id}
              d={path.d}
              stroke="currentColor"
              strokeWidth={path.strokeWidth}
              strokeOpacity={path.strokeOpacity}
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
    </div>
  );
}
