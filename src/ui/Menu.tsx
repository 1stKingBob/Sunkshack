import { FloatingPaths } from './FloatingPaths';
import { OptionWheel, type WheelItem } from './OptionWheel';

export type Destination = 'dashboard' | 'community' | 'method' | 'exit';

const ITEMS: (WheelItem & { key: Destination })[] = [
  { key: 'dashboard', label: 'Dashboard', hint: 'Check a room' },
  { key: 'community', label: 'Community', hint: 'Rooms others have measured' },
  { key: 'method', label: 'Method', hint: 'The standards and the maths' },
  { key: 'exit', label: 'Exit', hint: 'Back to the start' },
];

export function Menu({ onGo }: { onGo(d: Destination): void }) {
  return (
    <div className="menu">
      {/* Quieter than the intro: there is a menu to read on top of this one. */}
      <FloatingPaths position={-1} intensity={0.45} />

      <header className="menu-head">
        <span className="wordmark" style={{ color: 'var(--paper)' }}>
          <span className="glyph glyph-light" />
          Weave
        </span>
      </header>

      <OptionWheel
        items={ITEMS}
        defaultSelected={0}
        side="left"
        fontSize={2.7}
        spacing={1.72}
        curve={13}
        tilt={7}
        blur={1.7}
        fade={0.26}
        smoothing={260}
        onActivate={(i) => onGo(ITEMS[i].key)}
      />

      <p className="menu-help">
        Scroll or use ↑ ↓ to browse · Enter or click to open
      </p>
    </div>
  );
}
