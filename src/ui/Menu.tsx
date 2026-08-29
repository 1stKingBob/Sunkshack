import { useState } from 'react';
import { FloatingPathsBackground } from './FloatingPaths';
// Ships as .jsx and is kept byte-identical to the react-bits source.
import OptionWheel from './OptionWheel.jsx';

export type Destination = 'dashboard' | 'community' | 'method' | 'exit';

const ITEMS: { key: Destination; label: string; hint: string }[] = [
  { key: 'dashboard', label: 'Dashboard', hint: 'Check a room' },
  { key: 'community', label: 'Community', hint: 'Places others have measured' },
  { key: 'method', label: 'Method', hint: 'The standards and the maths' },
  { key: 'exit', label: 'Exit', hint: 'Back to the start' },
];

const LABELS = ITEMS.map((i) => i.label);

export function Menu({ onGo }: { onGo(d: Destination): void }) {
  const [index, setIndex] = useState(0);

  return (
    <div className="menu">
      <FloatingPathsBackground position={-1} count={10} />

      <header className="menu-head">
        <span className="wordmark" style={{ color: 'var(--paper)' }}>
          <span className="glyph glyph-light" />
          Weave
        </span>
      </header>

      <div className="menu-wheel">
        <OptionWheel
          items={LABELS}
          defaultSelected={0}
          textColor="#a6a6a6"
          activeColor="#ffffff"
          side="left"
          fontSize={3}
          spacing={1.4}
          curve={1}
          tilt={6}
          blur={2}
          fade={0.25}
          smoothing={200}
          inset={80}
          loop={false}
          draggable
          onChange={(i: number) => setIndex(i)}
        />
      </div>

      {/* The wheel takes plain strings, so the hint for whatever is currently
          centred sits alongside it rather than inside an option. */}
      <div className="menu-caption">
        <span className="menu-hint">{ITEMS[index].hint}</span>
        <button className="btn menu-open" onClick={() => onGo(ITEMS[index].key)}>
          Open {ITEMS[index].label} →
        </button>
      </div>

      <p className="menu-help">Scroll, drag or use ↑ ↓ · click an option to centre it</p>
    </div>
  );
}
