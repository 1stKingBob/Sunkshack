/**
 * The guide page — how to actually use the two halves of the app: checking a
 * room on the Dashboard, and finding or publishing real places on Community.
 * Reachable from the menu wheel and from the "Method" view key in App.tsx —
 * kept as-is internally, only what's shown changed.
 */
export function Method() {
  return (
    <div className="page">
      <div className="page-inner">
        <h1 className="page-title">How to use Weave</h1>
        <p className="page-lede">
          Weave has two parts. The <strong>Dashboard</strong> checks whether one specific room works
          for someone using a wheelchair or a walker. <strong>Community</strong> shows what other
          people found when they checked real, nearby places — and lets you publish your own.
        </p>

        <h2 className="page-h2">Dashboard — checking a room</h2>
        <ol>
          <li>
            Set the room's <strong>width and depth</strong>, in millimetres. This is the one
            measurement Weave takes as fact — everything else is scaled against it.
          </li>
          <li>
            Add furniture. Drag pieces in from the panel on the left, or use{' '}
            <strong>Upload photos</strong> / <strong>Take a photo</strong> and let it place them for
            you — positions from a photo are estimates until you drag a piece to confirm it.
          </li>
          <li>
            Mark the door as the <strong>entry</strong> point, then add a{' '}
            <strong>destination</strong> for everywhere someone actually needs to reach — the bed,
            a window, a desk. A room can have plenty of open floor and still fail if that floor
            isn't between the door and the places that matter.
          </li>
          <li>
            Pick <strong>who it's for</strong> from the profile dropdown — a manual wheelchair or
            two passing under AS 1428.1, a wheelchair under the ADA, or a walker/rollator. Each
            profile carries its own minimum route width and turning circle.
          </li>
          <li>
            Read the <strong>Findings</strong> panel. Each route and the turning circle show pass
            or fail with the exact measurement and, if it fails, exactly how far short it is. On a
            small screen, tap the <strong>▾</strong> in its header to collapse it and see the room
            underneath.
          </li>
          <li>
            If something fails, tap <strong>Suggest a fix</strong> for the smallest furniture move
            that clears it with real margin to spare — not just a bare pass. A dashed outline shows
            where the piece would go; <strong>Apply</strong> it or <strong>Dismiss</strong> the
            suggestion.
          </li>
          <li>
            Tap <strong>Generate Care Pass</strong> for a shareable summary of the check. Export it
            to publish the room to Community, or to keep as a record.
          </li>
        </ol>

        <h2 className="page-h2">Community — finding and publishing real places</h2>
        <ol>
          <li>Open Community from the menu, and search for a restaurant, building, or address.</li>
          <li>
            Each result shows <strong>Accessible</strong>, <strong>Not accessible</strong>, or{' '}
            <strong>—</strong> if nobody has checked it yet. That badge only reads Accessible if
            every submitted report clears the required figures with real margin — a room that just
            barely meets the code minimum doesn't count.
          </li>
          <li>
            Tap a result to see its location on the map, its address, and every report submitted
            for it. Tick <strong>Wheelchair accessible only</strong> to filter the list.
          </li>
          <li>
            Tap <strong>Add an accessibility report</strong> to publish your own — upload the Care
            Pass file you exported from the Dashboard, pick the building, and submit.
          </li>
        </ol>

        <h2 className="page-h2">A couple of things worth knowing</h2>
        <ul>
          <li>The <strong>mm / ft·in</strong> toggle, top right, switches units everywhere at once.</li>
          <li>
            Photo analysis and the Community map both need an API key to work live. Without one,
            the Dashboard falls back to manual placement and Community falls back to a sample list
            — both say so rather than showing a blank screen.
          </li>
          <li>
            Weave checks the layout you gave it against the figures you selected. It isn't a
            certification: it says nothing about doorway hardware, floor surfaces, thresholds,
            lighting, or reach ranges.
          </li>
        </ul>
      </div>
    </div>
  );
}
