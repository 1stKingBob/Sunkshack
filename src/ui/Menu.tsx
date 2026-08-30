import { useEffect, useState } from 'react';
// Ships as .jsx; the react-bits source plus an onActivate callback.
import OptionWheel from './OptionWheel.jsx';
import { MenuFlow } from './MenuFlow';
import weaveMarkDark from '../assets/weave-mark-dark.png';

const PHONE_QUERY = '(max-width: 640px)';

/**
 * Whether to skip MenuFlow entirely below the phone breakpoint — not a CSS
 * display:none on the wrapper. Motion's rAF loop keeps ticking for a
 * display:none element (only paint is skipped, not the JS driving it), and
 * a phone is exactly where the frame budget documented above is tightest.
 * Not rendering the component at all is what actually stops the work.
 */
function useIsPhone() {
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const onChange = () => setIsPhone(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isPhone;
}

export type Destination = 'dashboard' | 'community' | 'method' | 'exit';

const ITEMS: { key: Destination; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'community', label: 'Community' },
  { key: 'method', label: 'Guide' },
  { key: 'exit', label: 'Exit' },
];

const LABELS = ITEMS.map((i) => i.label);

/**
 * The menu is the wheel plus a background on the empty right side, where the
 * wheel (side="left") never draws.
 *
 * A full-screen version of FloatingPathsBackground was tried here first and
 * reverted: that effect re-rasterises every stroke on the CPU each frame,
 * and competed with the wheel's own rAF loop for the same budget, which
 * made the options flicker and drop out. MenuFlow (see MenuFlow.tsx) uses
 * the same technique at a low, tuned count instead of that component's
 * fixed geometry, and stays confined to the right half with
 * pointer-events: none, so it can neither compete for frames at full scale
 * nor intercept a drag. Below the phone breakpoint it isn't rendered at
 * all, by request — a phone has the least frame budget to spare of any
 * screen this runs on, and the empty space it was decorating is also the
 * first thing to disappear once the layout stacks that narrow.
 */
export function Menu({ onGo }: { onGo(d: Destination): void }) {
  const isPhone = useIsPhone();
  return (
    <div className="menu">
      {!isPhone && (
        <div className="menu-fp">
          <MenuFlow count={13} />
        </div>
      )}
      <header className="menu-head">
        <img src={weaveMarkDark} alt="Weave" className="wordmark-img" />
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
