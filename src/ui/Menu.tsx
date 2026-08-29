// Ships as .jsx; the react-bits source plus an onActivate callback.
import OptionWheel from './OptionWheel.jsx';

export type Destination = 'dashboard' | 'community' | 'method' | 'exit';

const ITEMS: { key: Destination; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'community', label: 'Community' },
  { key: 'method', label: 'Method' },
  { key: 'exit', label: 'Exit' },
];

const LABELS = ITEMS.map((i) => i.label);

/**
 * The menu is the wheel and nothing else.
 *
 * There is deliberately no animated background here. The paths effect
 * re-rasterises every stroke on the CPU each frame, and it was competing with
 * the wheel's own rAF loop for the same budget on the same screen — the wheel
 * is the interactive thing, so it gets the frames. The intro still has it,
 * where nothing else is moving.
 */
export function Menu({ onGo }: { onGo(d: Destination): void }) {
  return (
    <div className="menu">
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
          onActivate={(i: number) => onGo(ITEMS[i].key)}
        />
      </div>

      <p className="menu-help">Scroll, drag or use ↑ ↓ · click to centre, click again to open</p>
    </div>
  );
}
