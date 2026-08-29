import { useHashRoute } from './lib/router';
import { googleMapsConfigured } from './lib/googleMaps';
import { supabaseConfigured } from './lib/supabase';
import { MapPage } from './pages/MapPage';
import { UploadPage } from './pages/UploadPage';
import { SampleList } from './SampleList';
import type { UnitSystem } from '../units';
import './community.css';

/**
 * Community — search real places, see the accessibility scores other people's
 * room checks have given them, and publish your own.
 *
 * Ported in from what was a standalone app with its own dev server. Two things
 * had to change and neither is cosmetic:
 *
 * 1. Its stylesheet is scoped under `.cx` (see community.css). It was written
 *    to own the page and defines .app, .topbar, .btn and friends, which
 *    already mean something else here.
 * 2. Its own top bar is dropped — this renders inside the main app's shell,
 *    which already carries the wordmark, the unit toggle and the way back to
 *    the menu. Two stacked headers is not a design, it is a merge artefact.
 *
 * THE FALLBACK MATTERS. This screen is useless without a Google Maps key and a
 * Supabase project: no map renders, no scores load. Rather than show an empty
 * page with a configuration banner — which on a projector reads as a broken
 * feature — it falls back to the sample list, which at least demonstrates what
 * an entry is. The banner there says plainly that the live map is off and what
 * would turn it on.
 */
export function CommunityApp({ units }: { units: UnitSystem }) {
  const route = useHashRoute();

  // The map is the whole screen; without it there is nothing to show.
  if (!googleMapsConfigured) return <SampleList units={units} />;

  return (
    <div className="cx">
      {!supabaseConfigured && (
        <div className="banner">
          Supabase is not configured, so scores cannot load or be saved. Place search still works.
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in{' '}
          <code>.env.local</code>.
        </div>
      )}
      {route.name === 'upload' ? (
        <UploadPage placeIdParam={route.placeId} reportParam={route.report} />
      ) : (
        <MapPage />
      )}
    </div>
  );
}
