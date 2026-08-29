import { useEffect, useState } from 'react';
import { FloatingPaths } from './FloatingPaths';

interface Props {
  onDone(): void;
}

/**
 * The opening screen.
 *
 * Dark, so the cut to the paper-white plan lands as a reveal rather than as a
 * second page. It holds for a beat and then dissolves — and any click or key
 * skips it, because sitting through an animation on every reload gets old
 * inside four minutes, and getting stuck behind one during a live demo would
 * be worse than not having it.
 */
export function Intro({ onDone }: Props) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leave = () => setLeaving(true);
    const hold = setTimeout(leave, 2100);
    window.addEventListener('keydown', leave);
    window.addEventListener('pointerdown', leave);
    return () => {
      clearTimeout(hold);
      window.removeEventListener('keydown', leave);
      window.removeEventListener('pointerdown', leave);
    };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onDone, 620);
    return () => clearTimeout(t);
  }, [leaving, onDone]);

  return (
    <div className="intro" data-leaving={leaving}>
      <FloatingPaths position={1} />
      <FloatingPaths position={-1} intensity={0.7} />

      <div className="intro-mark">
        <h1 className="intro-word" aria-label="Weave">
          {'WEAVE'.split('').map((c, i) => (
            <span key={i} style={{ animationDelay: `${140 + i * 85}ms` }}>
              {c}
            </span>
          ))}
        </h1>
        <div className="intro-rule" />
        <p className="intro-sub">Does this room actually work for the person in it?</p>
      </div>

      <p className="intro-skip">Click anywhere to skip</p>
    </div>
  );
}
