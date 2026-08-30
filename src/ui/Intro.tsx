import { useEffect, useState } from 'react';
import { FloatingPathsBackground } from './FloatingPaths';
import weaveWordmarkDark from '../assets/weave-wordmark-dark.png';

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
      <FloatingPathsBackground position={-1} count={16} />

      <div className="intro-mark">
        <h1 style={{ margin: 0 }}>
          <img
            src={weaveWordmarkDark}
            alt="Weave — connecting the threads that build communities"
            className="intro-logo"
          />
        </h1>
      </div>

      <p className="intro-skip">Click anywhere to skip</p>
    </div>
  );
}
