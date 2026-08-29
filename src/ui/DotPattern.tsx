import { useId } from 'react';

interface DotPatternProps {
  width?: number;
  height?: number;
  cx?: number;
  cy?: number;
  cr?: number;
  /** any CSS colour — dots inherit it via fill */
  color?: string;
  /** CSS mask-image, e.g. a radial-gradient to fade the field at the edges */
  mask?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Ported from the shadcn/Tailwind original to plain CSS.
 *
 * The source version depends on Tailwind utility classes and a `cn` helper.
 * Weave has neither — it uses hand-written CSS with custom properties — and
 * installing Tailwind purely for this would drop its preflight reset on top of
 * a stylesheet that has already been tuned against it. The component is twenty
 * lines of SVG; it does not need a framework to earn its keep.
 */
export function DotPattern({
  width = 22,
  height = 22,
  cx = 1,
  cy = 1,
  cr = 1,
  color = 'currentColor',
  mask,
  className,
  style,
}: DotPatternProps) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        fill: color,
        WebkitMaskImage: mask,
        maskImage: mask,
        ...style,
      }}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          patternContentUnits="userSpaceOnUse"
        >
          <circle cx={cx} cy={cy} r={cr} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  );
}
