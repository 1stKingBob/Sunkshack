import type { FurnitureItem, MobilityProfile, Room } from '../types';
import { checkClearance } from './clearance';
import { footprint } from './grid';

/**
 * SUGGEST A FIX
 * ─────────────
 * Telling someone their room is 290 mm too narrow is only half an answer. The
 * useful half is *what to do about it*, and that is a search problem the
 * clearance engine is already equipped to answer.
 *
 * The naive version — try every position for every item — is far too slow to
 * run on a click, so this narrows the search the way a person would:
 *
 *   1. Only move furniture that is actually implicated. A piece on the far
 *      side of the room is not what is pinching the route, so it is not a
 *      candidate. Items are ranked by how close they sit to the bottleneck.
 *   2. Only consider positions furniture plausibly goes — flat against a wall,
 *      in both orientations. Nobody solves a clearance problem by parking the
 *      wardrobe in the middle of the floor.
 *   3. Prefer the smallest move that works, so the suggestion reads as advice
 *      rather than as a redecoration.
 *
 * Candidates that overlap something else are discarded before the expensive
 * check runs, and the whole search is bounded by both an evaluation cap and a
 * wall-clock budget so it can never hang the page. If nothing fully passes it
 * returns the best near-miss rather than nothing, because "this gets you to
 * 940 mm, you need 1000" is still worth knowing.
 */

export interface Suggestion {
  itemId: string;
  itemLabel: string;
  from: { x: number; y: number; rotation: number };
  to: { x: number; y: number; rotation: number };
  /** mm the piece travels */
  distance: number;
  /** does the whole room pass with this change */
  solves: boolean;
  /** narrowest route width after the move, mm */
  resultingBottleneck: number;
  /** narrowest route width before, mm */
  originalBottleneck: number;
  evaluations: number;
  ms: number;
}

const CLEARANCE_FROM_WALL = 20; // mm — furniture sits flush, not embedded
const STEP = 150; // mm between candidate slots along a wall
const MAX_EVALUATIONS = 320;
const TIME_BUDGET_MS = 2200;

/**
 * How disruptive it is to move each kind of thing, as a multiplier on distance.
 *
 * Millimetres travelled is the obvious cost function and it is the wrong one.
 * By raw distance the engine will happily advise heaving a king bed two metres
 * rather than walking a wardrobe two and a half, because the bed's move is
 * shorter — which is true and useless. Anyone who has actually moved furniture
 * knows a wardrobe is a job and a bed is an afternoon.
 */
const MOVE_COST: Record<string, number> = {
  bed: 2.4,
  sofa: 1.8,
  wardrobe: 1.3,
  bookcase: 1.2,
  desk: 1.0,
  dresser: 1.0,
  table: 0.8,
  nightstand: 0.6,
  chair: 0.5,
  other: 1.0,
};

/** Turning a piece is a bigger intrusion than sliding it along the same wall. */
const ROTATION_PENALTY = 1.35;

function boxOf(item: FurnitureItem, x: number, y: number, rotation: number) {
  const swapped = rotation === 90 || rotation === 270;
  const w = swapped ? item.depth : item.width;
  const d = swapped ? item.width : item.depth;
  return { minX: x - w / 2, maxX: x + w / 2, minY: y - d / 2, maxY: y + d / 2, w, d };
}

function overlaps(a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>) {
  return !(a.maxX <= b.minX || a.minX >= b.maxX || a.maxY <= b.minY || a.minY >= b.maxY);
}

/** Distance from a point to an item's footprint, 0 if inside. */
function distanceToItem(item: FurnitureItem, px: number, py: number) {
  const f = footprint(item);
  const dx = Math.max(f.minX - px, 0, px - f.maxX);
  const dy = Math.max(f.minY - py, 0, py - f.maxY);
  return Math.hypot(dx, dy);
}

/** Every wall-aligned slot the item could occupy, in both orientations. */
function wallCandidates(item: FurnitureItem, room: Room) {
  const out: { x: number; y: number; rotation: number }[] = [];
  for (const rotation of [0, 90] as const) {
    const swapped = rotation === 90;
    const w = swapped ? item.depth : item.width;
    const d = swapped ? item.width : item.depth;
    if (w > room.width || d > room.depth) continue;

    const halfW = w / 2;
    const halfD = d / 2;

    for (let x = halfW + CLEARANCE_FROM_WALL; x <= room.width - halfW; x += STEP) {
      out.push({ x, y: halfD + CLEARANCE_FROM_WALL, rotation }); // north wall
      out.push({ x, y: room.depth - halfD - CLEARANCE_FROM_WALL, rotation }); // south
    }
    for (let y = halfD + CLEARANCE_FROM_WALL; y <= room.depth - halfD; y += STEP) {
      out.push({ x: halfW + CLEARANCE_FROM_WALL, y, rotation }); // west wall
      out.push({ x: room.width - halfW - CLEARANCE_FROM_WALL, y, rotation }); // east
    }
  }
  return out;
}

function worstBottleneck(room: Room, profile: MobilityProfile): number {
  const res = checkClearance(room, profile);
  if (res.routes.length === 0) return Infinity;
  return Math.min(...res.routes.map((r) => r.bottleneck));
}

export function suggestFix(room: Room, profile: MobilityProfile): Suggestion | null {
  const t0 = performance.now();
  const before = checkClearance(room, profile);
  if (before.passes) return null;

  // Where is the problem? Prefer a route bottleneck; fall back to the turning
  // circle's centre if the only failure is turning space.
  const routeViolation = before.violations.find(
    (v) => v.type === 'path_width' || v.type === 'unreachable',
  );
  const focus = routeViolation?.location ?? before.turningCircle?.centre;
  if (!focus) return null;

  const originalBottleneck =
    before.routes.length > 0 ? Math.min(...before.routes.map((r) => r.bottleneck)) : 0;

  // Rank furniture by proximity to the pinch — the culprit is nearly always
  // one of the two pieces forming it.
  const culprits = [...room.furniture]
    .map((item) => ({ item, d: distanceToItem(item, focus.x, focus.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 2)
    .map((c) => c.item);

  let best: Suggestion | null = null;
  let evaluations = 0;

  // Candidates from every culprit are pooled and sorted together, so the search
  // returns the smallest move that works *overall* rather than the first move
  // that works for whichever piece happened to be nearest the pinch. Without
  // this it would cheerfully tell you to heave the bed two metres when sliding
  // the wardrobe half a metre would have done.
  const pool: {
    item: FurnitureItem;
    x: number;
    y: number;
    rotation: number;
    dist: number;
    cost: number;
  }[] = [];

  for (const item of culprits) {
    const others = room.furniture.filter((f) => f.id !== item.id);
    for (const c of wallCandidates(item, room)) {
      // discard anything that would sit inside another piece before paying for
      // a full clearance check
      const box = boxOf(item, c.x, c.y, c.rotation);
      if (others.some((o) => overlaps(box, boxOf(o, o.x, o.y, o.rotation)))) continue;
      const dist = Math.hypot(c.x - item.x, c.y - item.y);
      if (dist <= 150) continue;
      const cost =
        dist *
        (MOVE_COST[item.type] ?? 1) *
        (c.rotation !== item.rotation ? ROTATION_PENALTY : 1);
      pool.push({ item, ...c, dist, cost });
    }
  }
  pool.sort((a, b) => a.cost - b.cost);

  {
    for (const cand of pool) {
      const item = cand.item;
      if (evaluations >= MAX_EVALUATIONS) break;
      if (performance.now() - t0 > TIME_BUDGET_MS) break;
      evaluations += 1;

      const trial: Room = {
        ...room,
        furniture: room.furniture.map((f) =>
          f.id === item.id
            ? { ...f, x: cand.x, y: cand.y, rotation: cand.rotation as FurnitureItem['rotation'] }
            : f,
        ),
      };

      const res = checkClearance(trial, profile);
      const bottleneck =
        res.routes.length > 0 ? Math.min(...res.routes.map((r) => r.bottleneck)) : Infinity;

      const candidate: Suggestion = {
        itemId: item.id,
        itemLabel: item.label ?? item.type,
        from: { x: item.x, y: item.y, rotation: item.rotation },
        to: { x: cand.x, y: cand.y, rotation: cand.rotation },
        distance: Math.round(cand.dist),
        solves: res.passes,
        resultingBottleneck: bottleneck,
        originalBottleneck,
        evaluations,
        ms: 0,
      };

      if (res.passes) {
        // The pool is sorted by weighted disruption, so the first full
        // solution found is also the least disruptive one available.
        candidate.ms = performance.now() - t0;
        return candidate;
      }

      // otherwise remember the best near-miss
      if (!best || bottleneck > best.resultingBottleneck) best = candidate;
    }
  }

  if (best) best.ms = performance.now() - t0;
  return best;
}

/** Apply a suggestion, returning a new room. */
export function applySuggestion(room: Room, s: Suggestion): Room {
  return {
    ...room,
    furniture: room.furniture.map((f) =>
      f.id === s.itemId
        ? {
            ...f,
            x: s.to.x,
            y: s.to.y,
            rotation: s.to.rotation as FurnitureItem['rotation'],
            provenance: 'user' as const,
          }
        : f,
    ),
  };
}

export { worstBottleneck };
