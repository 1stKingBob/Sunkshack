# Weave

**Does this room actually work for the person in it?**

Every room-planning tool on the market optimises for how a space *looks*. None of
them check whether it *works*. Weave checks whether someone using a wheelchair or
a walker can actually get from the door to the places they need to reach, and
whether there is anywhere they can turn around.

The failure it is built to catch is the one people cannot see: a bed against one
wall is fine, a wardrobe against the other wall is fine, and the 735 mm between
them is not. Nobody spots that by eye, because you are never looking at both
pieces and the space between them at the same time.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine unit tests
npm run build    # production build
```

Photo analysis needs a key. Copy `.env.example` to `.env.local` and add an
`ANTHROPIC_API_KEY`. Everything else works without one — the app falls back to
manual placement and says so.

Deploy: push to a repo and import it in Vercel. `api/analyze.ts` is picked up as
a serverless function automatically; add `ANTHROPIC_API_KEY` in the project's
environment variables. Nothing else to configure.

## How it works

### One field, two checks

Everything reads off a single precomputed field: for every point in the room,
how much free space surrounds it.

- Someone can **turn** at a point ⟺ that point's clearance ≥ their turning radius.
- A **route** of width W exists ⟺ there is a connected chain of points whose
  clearance never drops below W/2.

These are not two systems. They are two reads of the same field, which is why
the whole check re-runs in about 8 ms and can run on every frame of a drag.

### Measurements are analytic, not rasterised

Clearance is computed in closed form — exact point-to-rectangle distance —
rather than by counting grid cells. This is not premature precision. A
rasterised distance transform has to round furniture outward to whole cells and
then correct back by half a cell, and those errors do not cancel: on a 50 mm
grid it under-reported a real 735 mm gap as 650 mm. For a tool whose entire
claim is *we give you the actual number*, an 85 mm systematic error in the
headline figure is not a rounding detail.

The grid still exists — it is what the route search walks over — but its
resolution only affects how finely a path can bend, not what any measurement
says.

### Routes are widest-path, then shortest

When a room fails, "there is no route" is useless. So the search is a **widest
path** (maximin) search: it returns the best route that exists and the exact
width of its narrowest point — the number that tells you whether to move the
wardrobe 300 mm or rethink the room.

A second pass then finds the **shortest** route among those achieving that same
width. Without it the search wanders, since every route sharing the same
bottleneck ties.

### Anchors have an approach zone

An anchor is somewhere you are trying to *arrive at* — a doorway, the side of a
bed — and arriving somewhere always means approaching a wall or an object, so
clearance there is near zero by construction. Measuring corridor width across a
doorway would fail every room ever built. AS 1428.1 reflects this directly: a
doorway has its own clear-width figure (850 mm) that is deliberately smaller
than the 1000 mm required of a circulation route. So cells within the turning
radius of an anchor are exempt from the width test — in both the search and the
measurement, using one shared mask so the two cannot disagree.

## What the photo does and does not do

The photo is used to identify *what is in the room* and roughly *where*. It is
never used to measure anything. A single photograph has no scale — a queen bed
far away and a king bed close up are the same pixels — so sizes come from a
standard-size table with one-tap correction, and the room dimensions you type
are what scale the layout into millimetres.

Positions derived this way are drawn lighter and marked "estimated" in the
furniture list, and the Care Pass says so. Dragging a piece confirms it.

If the vision call fails, times out, or returns something implausible, the app
falls back to heuristic placement — big things against the nearest wall,
nightstands beside the bed — and tells you it did.

## Accessibility of the tool itself

Signal Crimson and Forest Emerald sit at a contrast ratio of **1.27:1** against
each other. They differ almost purely in hue, which is the one axis a red–green
colourblind viewer cannot use. Encoding pass and fail in colour alone would make
an accessibility tool inaccessible.

So failures are **hatched** and passes are solid — which survives greyscale,
survives colourblindness, and is how a real architectural drawing marks a
problem area anyway. The measurement is always printed as well, giving a third
redundant channel.

Warm Timber is only 2.74:1 against the paper background, below the 3:1 needed
for a shape to be distinguishable, so the Slate Ink outline on furniture is
load-bearing rather than decorative.

## Reference figures

| Profile | Route minimum | Turning |
|---|---|---|
| Manual wheelchair, AS 1428.1 (AU) | 1000 mm | ⌀ 1540 mm |
| Two wheelchairs passing, AS 1428.1 | 1800 mm | ⌀ 1540 mm |
| Wheelchair, ADA (US) | 915 mm (36″) | ⌀ 1525 mm (60″) |

A full 180° turn under AS 1428.1 wants 2070 mm in the direction of travel; this
checks the 1540 mm circle. Every figure carries its source in the UI. Nothing in
`src/profiles.ts` is a number we invented — if you change one, change its
`source` string with it.

**Weave is not a certification and not a full accessibility assessment.** It
checks the layout you gave it against the figures you selected. It says nothing
about doorway hardware, floor surfaces, thresholds, lighting, or reach ranges.
The UI never says "ADA compliant"; it says "meets the clearance settings you
defined".

## Community

The Community screen searches real places on a Google map and shows the
accessibility score that other people's room checks have given them. It needs
three values in `.env.local` (see `.env.example`) and `supabase/schema.sql`
run once against a fresh Supabase project.

Without a Maps key it falls back to a labelled sample list rather than showing
an empty page — a configuration banner on a projector reads as a broken
feature, and there is no useful fallback for a map itself.

A score is not a rating anyone typed. `src/community/lib/score.ts` derives a
0–10 number from a report's measured-versus-required margins: 0 at half the
required clearance, 5 at exactly the minimum, 10 at 1.5× or more. A bare pass
is not a 10, because a bare pass is not comfortable. It exists so the search
filter has something to sort on, not as a certification.

Its stylesheet is scoped under `.cx` (`src/community/community.css`). It was
written as a standalone app that owned the whole page and defines `.app`,
`.topbar`, `.btn` and others that already mean something else here.

The handoff runs through `buildReport` in `src/ui/CarePass.tsx`: a plain,
versioned JSON object carrying routes, measurements and the profile used —
and deliberately not furniture positions, photos, or an address. Publishing a
clearance summary should not mean publishing a floor plan of where someone
sleeps.

## Layout

```
src/types.ts          shared contract — every length in mm, one canonical unit
src/units.ts          display-only metric/imperial formatting
src/profiles.ts       mobility profiles, each with its source
src/engine/grid.ts    analytic clearance field
src/engine/clearance.ts  widest-path + turning-circle checks
src/engine/*.test.ts  12 tests, incl. the emergent-failure case
src/pipeline/         photo → detections → placed furniture, with fallback
src/scene/            three.js plan view, drag, hatching, wheelchair
src/ui/               rail, findings, Care Pass
api/analyze.ts        serverless vision call — the API key lives only here
src/community/        map, scores, report upload (scoped CSS, own lib/)
supabase/schema.sql   run once against a fresh Supabase project
```

## Tests

```
npm test
```

Twelve tests. The one that matters most asserts that a dresser alone passes, a
bookcase alone passes, and the two together fail — the emergent case the whole
product exists to catch.
