## Elevator pitch

Connecting the threads that build communities.

## Inspiration

Every room-planning tool on the market optimises for how a space *looks*. None of them check whether it *works*. We kept coming back to one failure case: a bed against one wall is fine, a wardrobe against the other wall is fine, and the 735 mm gap left between them is not. Nobody spots that by eye, because you're never looking at both pieces of furniture and the space between them at the same time — you're looking at the room. AS 1428.1 has an exact number for how wide a wheelchair route needs to be. Nothing in the room-planning tools we looked at was checking it.

## What it does

You type the room's width and depth — the one measurement we treat as ground truth — then either drag furniture in yourself or upload a few photos and let a vision model place it for you. Pick who the room needs to work for (manual wheelchair or two wheelchairs passing under AS 1428.1, a wheelchair under the ADA, or a walker/rollator), and Weave checks two things off one shared clearance field: can you get from the door to everywhere you need to reach, and is there anywhere along the way to turn around. Fail, and it tells you exactly where and by how much — then "Suggest a fix" searches for the smallest furniture move that actually solves it, with a live before/after preview.

The Community screen turns individual room checks into something searchable: find a real place on the map, see whether previous visitors' room checks say it's genuinely wheelchair-accessible, or submit your own. A room only earns the "Accessible" badge if every route and the turning circle clear the code minimum with real margin to spare — meeting AS 1428.1 exactly, with zero room for error, doesn't count.

## How we built it

React + TypeScript on Vite, with a from-scratch clearance engine rather than a physics or pathfinding library: clearance at any point is computed analytically (closed-form point-to-rectangle distance), and a route of width W exists wherever there's a connected chain of points whose clearance never drops below W/2. The grid that exists underneath is only there to give the route search something to walk over — it never touches what a measurement actually reads. Route-finding is a widest-path (maximin) search, then shortest-path among routes that tie on width, so a failing room gets an exact bottleneck figure and the straightest route to it, not just "no route."

The room renders in three.js, with drag-and-recheck running in single-digit milliseconds so the check re-runs on every frame of a move. Photos go through a Vercel serverless function that calls Claude or Gemini (whichever key is set) to identify and roughly place furniture, degrading from calibrated → identified-only → manual-heuristic-fallback depending on what the model returns. The Community layer sits on Supabase (Postgres + RLS) for reports and the Google Maps/Places API (New) for search, kept as a separately-scoped app inside the same repo.

## Challenges we ran into

Google froze the legacy Places API for any Cloud project created after 1 March 2025 — a key made today simply can't call it. We migrated the map's search to Places API (New), then found the *building picker* on the "add a report" form still called the frozen `Autocomplete` widget and `PlacesService`, throwing "This page can't load Google Maps correctly" the instant anyone tried to search from that screen. Two separate migrations of the same underlying problem, discovered a screen apart.

Deciding what "accessible" should mean for a crowdsourced badge took real back-and-forth: a room that exactly meets AS 1428.1's 1000 mm minimum is a genuine pass with zero margin for error, a slightly wider wheelchair, or a measurement that's off by a centimetre. We settled on requiring 150 mm of real headroom above the code minimum before anything reads as "Accessible" — and then wired that same margin into "Suggest a fix," so a suggested move is one actually worth making, not one that just barely clears the bar on paper.

Mobile broke almost everything at once, in ways that only showed up once we actually tested on a phone: the top bar overflowed and dragged the entire page wider than the viewport; the Findings panel and the Community search sidebar were both fixed-size overlays sized for desktop, so on a phone they covered the 3D room and the map respectively, in full; and taking a photo backgrounds the tab for the native camera app, which on a WebGL-heavy page reliably gets the tab's memory reclaimed and reloaded by the OS on return — wiping every bit of unsaved state, because none of it was ever persisted anywhere.

## Accomplishments that we're proud of

The clearance measurement is exact, not approximate — a rasterised distance transform on a 50 mm grid under-reported a real 735 mm gap as 650 mm during testing, an 85 mm systematic error in the one number the whole tool exists to give you honestly. Computing it analytically instead means the grid only decides how finely a route can bend, never what any measurement says. The "Accessible" signal on the Community map means something specific and defensible — it requires margin, not just a technical pass — rather than being an average of numbers nobody can interpret. And the app degrades gracefully at every single layer: no vision key and photo upload just falls back to manual placement; no Maps key and Community falls back to a labelled sample list instead of a blank screen; no Supabase and search still works, scores just don't load. Nothing hard-fails just because one optional integration isn't configured.

## What we learned

Real accessibility standards have nuance that's easy to get wrong by being *too* literal: AS 1428.1 gives a doorway its own, deliberately smaller clear-width figure than a circulation route, because measuring corridor width straight across a doorway would fail every building ever constructed — you have to exempt the approach zone around an anchor point, not just check every point uniformly. And on the engineering side: assume any client-side state can vanish without warning on mobile, especially on a page doing real WebGL work, and design for that from the start rather than adding persistence after the first time it bites someone.

## What's next for Weave

Auth and ownership checks on community reports — the schema currently leaves row-level security wide open on purpose for a 24-hour build (anyone with the public key can post a score for any building), and that's the first thing to close before this is exposed to strangers on the internet. Beyond that: more mobility profiles, checks for doorway hardware and thresholds rather than just route width and turning space, and a properly touch-first furniture-editing flow for phones rather than the current fixed layout adapted to fit smaller screens.
