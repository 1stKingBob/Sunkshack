import { useCallback, useEffect, useRef, useState } from 'react';

export interface WheelItem {
  label: string;
  hint?: string;
}

interface Props {
  items: WheelItem[];
  defaultSelected?: number;
  onChange?(index: number, item: WheelItem): void;
  onActivate?(index: number, item: WheelItem): void;
  /** rem — size of the focused item */
  fontSize?: number;
  /** multiplier on fontSize for the gap between items */
  spacing?: number;
  /** px each step pushes an item sideways, squared with distance */
  curve?: number;
  /** degrees of X-rotation per step away from centre */
  tilt?: number;
  /** px of blur per step away from centre */
  blur?: number;
  /** opacity lost per step away from centre */
  fade?: number;
  /** ms transition */
  smoothing?: number;
  side?: 'left' | 'center';
  loop?: boolean;
  draggable?: boolean;
}

/**
 * A vertical option wheel: the focused row sits large and sharp at the centre
 * while its neighbours fall away, blurred and tilted, as if printed on a drum
 * turning behind the screen.
 *
 * Written from scratch — the brief supplied the call signature and a
 * screenshot, not an implementation.
 *
 * Motion is driven by CSS transitions off an integer index rather than by a
 * per-frame physics loop. It is far less code, it cannot drift or fail to
 * settle, and the browser can hand the whole thing to the compositor.
 *
 * It is fully operable by keyboard — arrows, Home/End, Enter — which for an
 * accessibility product is not a nice-to-have. A menu you can only reach by
 * dragging a mouse would undercut everything behind it.
 */
export function OptionWheel({
  items,
  defaultSelected = 0,
  onChange,
  onActivate,
  fontSize = 2.6,
  spacing = 1.45,
  curve = 14,
  tilt = 7,
  blur = 1.6,
  fade = 0.26,
  smoothing = 260,
  side = 'left',
  loop = false,
  draggable = true,
}: Props) {
  const [selected, setSelected] = useState(
    Math.min(items.length - 1, Math.max(0, defaultSelected)),
  );
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startIndex: number } | null>(null);
  const wheelAccum = useRef(0);

  const move = useCallback(
    (next: number) => {
      const n = items.length;
      const clamped = loop ? ((next % n) + n) % n : Math.min(n - 1, Math.max(0, next));
      setSelected((prev) => {
        if (prev !== clamped) onChange?.(clamped, items[clamped]);
        return clamped;
      });
    },
    [items, loop, onChange],
  );

  // Wheel and trackpad. Accumulated so a high-resolution trackpad does not fly
  // through every option on one flick.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelAccum.current += e.deltaY;
      const threshold = 46;
      while (Math.abs(wheelAccum.current) >= threshold) {
        const dir = Math.sign(wheelAccum.current);
        wheelAccum.current -= dir * threshold;
        move(selected + dir);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [move, selected]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!draggable) return;
    drag.current = { startY: e.clientY, startIndex: selected };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    move(drag.current.startIndex - Math.round(dy / 52));
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      move(selected + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      move(selected - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      move(items.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate?.(selected, items[selected]);
    }
  };

  return (
    <div
      ref={host}
      className="wheel"
      data-side={side}
      tabIndex={0}
      role="listbox"
      aria-label="Choose a section"
      aria-activedescendant={`wheel-opt-${selected}`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {items.map((item, i) => {
        const offset = i - selected;
        const dist = Math.abs(offset);
        const focused = offset === 0;
        return (
          <button
            key={item.label}
            id={`wheel-opt-${i}`}
            role="option"
            aria-selected={focused}
            tabIndex={-1}
            className="wheel-opt"
            data-focused={focused}
            style={{
              transform: `translate(-50%, -50%) translateY(${offset * fontSize * spacing}rem) translateX(${curve * dist * dist}px) perspective(700px) rotateX(${-offset * tilt}deg) scale(${focused ? 1 : Math.max(0.62, 1 - dist * 0.14)})`,
              opacity: Math.max(0.08, 1 - dist * fade),
              filter: focused ? 'none' : `blur(${Math.min(6, dist * blur)}px)`,
              fontSize: `${fontSize}rem`,
              transitionDuration: `${smoothing}ms`,
            }}
            onClick={() => (focused ? onActivate?.(i, item) : move(i))}
          >
            {item.label}
            {focused && item.hint && <span className="wheel-hint">{item.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
