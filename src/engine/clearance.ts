import type {
  ClearanceResult,
  ClearanceViolation,
  MobilityProfile,
  Room,
  RoutePath,
  TurningCircle,
} from '../types';
import {
  buildGrid,
  cellToPoint,
  DEFAULT_CELL_SIZE,
  nearestFreeCell,
  pointToCell,
  type ClearanceGrid,
} from './grid';

/**
 * THE WHOLE ENGINE IN ONE IDEA
 * ────────────────────────────
 * Both checks this app makes read off a single precomputed field: for every
 * point in the room, how much free space surrounds it.
 *
 *   • A wheelchair can TURN at a point ⟺ that point's clearance ≥ its radius.
 *   • A route of width W exists ⟺ there is a connected chain of points whose
 *     clearance never drops below W/2.
 *
 * They are not two systems. They are two reads of the same distance field,
 * which is why this runs in about a millisecond and can re-run on every frame
 * of a drag.
 *
 * The route search is a *widest path* (maximin) search rather than a plain
 * shortest path. That matters: when a room fails, "there is no route" is a
 * useless thing to tell someone. A widest-path search instead returns the best
 * route that exists and the exact width of its narrowest point — which is the
 * number that tells you whether to move the dresser 80 mm or rethink the room.
 */

/** Max-heap keyed by width. Small and dependency-free on purpose. */
class MaxHeap {
  private keys: number[] = [];
  private vals: number[] = [];

  get size() {
    return this.keys.length;
  }

  push(key: number, val: number) {
    this.keys.push(key);
    this.vals.push(val);
    let i = this.keys.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] >= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }

  /**
   * Returns the value only. Returning an object here allocated once per pop,
   * and with tens of thousands of pops per recompute that allocation pressure
   * was measurable in the drag loop.
   */
  pop(): number {
    const val = this.vals[0];
    const lastKey = this.keys.pop()!;
    const lastVal = this.vals.pop()!;
    if (this.keys.length > 0) {
      this.keys[0] = lastKey;
      this.vals[0] = lastVal;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let big = i;
        if (l < this.keys.length && this.keys[l] > this.keys[big]) big = l;
        if (r < this.keys.length && this.keys[r] > this.keys[big]) big = r;
        if (big === i) break;
        this.swap(i, big);
        i = big;
      }
    }
    return val;
  }

  private swap(a: number, b: number) {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.vals[a], this.vals[b]] = [this.vals[b], this.vals[a]];
  }
}

interface WidestResult {
  /** grid indices, start → goal */
  path: number[];
  reached: boolean;
  /** clearance radius at the narrowest exempt-adjusted point */
  width: number;
}

/**
 * Widest-path search: maximise the minimum clearance along the route.
 *
 * Diagonal steps are allowed but may not cut a corner between two blocked
 * cells — otherwise the engine would happily route a wheelchair through the
 * zero-width gap where two furniture corners touch.
 *
 * THE ENDPOINTS ARE EXEMPT from the width test, and this is a real modelling
 * decision rather than a fudge. A doorway anchor sits *in* a wall and a bedside
 * anchor sits *against* the bed, so both have near-zero clearance by
 * construction. Letting them count would mean every route in every room
 * reported a bottleneck of roughly zero, which is worse than useless. What is
 * being measured here is the width of the route *between* two points, not the
 * width at the two points you are trying to arrive at. (Doorway clear width is
 * a separate requirement with its own figure, and is not what this checks.)
 */
function widestPath(
  grid: ClearanceGrid,
  start: number,
  goal: number,
  exempt: Uint8Array,
): WidestResult {
  const n = grid.cols * grid.rows;
  const best = new Float64Array(n); // best bottleneck clearance reaching each cell
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);

  best[start] = Infinity;
  const heap = new MaxHeap();
  heap.push(best[start], start);

  while (heap.size > 0) {
    const u = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === goal) break;

    const ux = u % grid.cols;
    const uy = (u / grid.cols) | 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const vx = ux + dx;
        const vy = uy + dy;
        if (vx < 0 || vy < 0 || vx >= grid.cols || vy >= grid.rows) continue;

        if (dx !== 0 && dy !== 0) {
          // no squeezing diagonally between two blocked cells
          const a = uy * grid.cols + vx;
          const b = vy * grid.cols + ux;
          if (grid.blocked[a] || grid.blocked[b]) continue;
        }

        const v = vy * grid.cols + vx;
        if (done[v]) continue;
        // Never route through furniture, however close to an anchor it sits.
        if (grid.blocked[v]) continue;
        // Cells in the approach zone around either anchor do not gate the
        // width — the same rule routeBottleneck measures by, so that the
        // search optimises exactly what is later reported.
        const stepClearance = exempt[v] ? Infinity : grid.clearance[v];
        const cand = Math.min(best[u], stepClearance);
        if (cand > best[v]) {
          best[v] = cand;
          prev[v] = u;
          heap.push(cand, v);
        }
      }
    }
  }

  const reached = best[goal] > 0 || start === goal;
  if (!reached) return { path: [], reached: false, width: 0 };

  // The widest-path search only cares about the narrowest point, so among all
  // routes achieving that same width it has no preference — and inside the
  // exempt zones, where every candidate ties at Infinity, it wanders into
  // loops. A second pass fixes it: find the SHORTEST route among those that
  // achieve the widest bottleneck. The measurement is unchanged; the drawn
  // line becomes one a person would actually take.
  const width = best[goal];
  const path = shortestAtWidth(grid, start, goal, exempt, width);
  return { path, reached: true, width };
}

/** Dijkstra on true distance, restricted to cells at least `minClear` wide. */
function shortestAtWidth(
  grid: ClearanceGrid,
  start: number,
  goal: number,
  exempt: Uint8Array,
  minClear: number,
): number[] {
  const n = grid.cols * grid.rows;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const tol = 1e-6;

  dist[start] = 0;
  // Min-heap via a max-heap on negated cost — one heap implementation is
  // enough for both searches.
  const heap = new MaxHeap();
  heap.push(0, start);

  while (heap.size > 0) {
    const u = heap.pop();
    if (done[u]) continue;
    done[u] = 1;
    if (u === goal) break;

    const ux = u % grid.cols;
    const uy = (u / grid.cols) | 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const vx = ux + dx;
        const vy = uy + dy;
        if (vx < 0 || vy < 0 || vx >= grid.cols || vy >= grid.rows) continue;
        if (dx !== 0 && dy !== 0) {
          if (grid.blocked[uy * grid.cols + vx] || grid.blocked[vy * grid.cols + ux]) continue;
        }
        const v = vy * grid.cols + vx;
        if (done[v] || grid.blocked[v]) continue;
        if (exempt[v] !== 1 && grid.clearance[v] < minClear - tol) continue;
        const step = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
        const nd = dist[u] + step;
        if (nd < dist[v]) {
          dist[v] = nd;
          prev[v] = u;
          heap.push(-nd, v);
        }
      }
    }
  }

  if (dist[goal] === Infinity) return [];
  const path: number[] = [];
  let cur = goal;
  let guard = 0;
  while (cur !== -1 && guard++ < n) {
    path.push(cur);
    if (cur === start) break;
    cur = prev[cur];
  }
  return path.reverse();
}

/**
 * The usable width of a route, measured over its interior only.
 *
 * Cells within `graceRadius` of either endpoint are excluded, and this models
 * something real rather than papering over a bad number. An anchor is a place
 * you are trying to *arrive at* — a doorway, the side of a bed — and arriving
 * somewhere always means approaching a wall or an object. AS 1428.1 reflects
 * this directly: a doorway has its own clear-width figure (850 mm) that is
 * deliberately *smaller* than the 1000 mm required of a circulation route,
 * precisely because a doorway is not a corridor. Measuring the corridor
 * requirement across a doorway would fail every room ever built.
 *
 * Returns the width in mm and the index of the narrowest qualifying cell.
 */
function routeBottleneck(
  grid: ClearanceGrid,
  path: number[],
  exempt: Uint8Array,
): { width: number; at: number } {
  if (path.length === 0) return { width: 0, at: 0 };

  let at = -1;
  let minClear = Infinity;

  for (let i = 1; i < path.length - 1; i++) {
    if (exempt[path[i]]) continue;
    if (grid.clearance[path[i]] < minClear) {
      minClear = grid.clearance[path[i]];
      at = path[i];
    }
  }

  // Short hop: the two anchors are close enough that the whole route sits in
  // the approach zone. There is no corridor between them to be too narrow.
  if (at === -1) {
    let best = 0;
    let bestAt = path[0];
    for (const i of path) {
      if (grid.clearance[i] > best) {
        best = grid.clearance[i];
        bestAt = i;
      }
    }
    return { width: best * 2, at: bestAt };
  }

  // clearance is a radius; a route's usable width is twice that
  return { width: minClear * 2, at };
}

/**
 * Mark every cell within `radius` of either endpoint as exempt from the width
 * test. Shared by the search and the measurement so the two cannot disagree.
 */
function approachZone(
  grid: ClearanceGrid,
  a: number,
  b: number,
  radius: number,
): Uint8Array {
  const mask = new Uint8Array(grid.cols * grid.rows);
  const pa = cellToPoint(grid, a);
  const pb = cellToPoint(grid, b);
  const rSq = radius * radius;
  // Walked as a nested loop with no per-cell allocation — this runs on every
  // frame of a drag, and allocating a point object per cell would dominate it.
  for (let y = 0; y < grid.rows; y++) {
    const py = (y + 0.5) * grid.cellSize;
    const dya = (py - pa.y) ** 2;
    const dyb = (py - pb.y) ** 2;
    for (let x = 0; x < grid.cols; x++) {
      const px = (x + 0.5) * grid.cellSize;
      if ((px - pa.x) ** 2 + dya <= rSq || (px - pb.x) ** 2 + dyb <= rSq) {
        mask[y * grid.cols + x] = 1;
      }
    }
  }
  return mask;
}

/** Nearest cell to `index` whose clearance is at least `radius`, or -1. */
function nearestCellWithClearance(
  grid: ClearanceGrid,
  index: number,
  radius: number,
): number {
  if (grid.clearance[index] >= radius) return index;
  const sx = index % grid.cols;
  const sy = (index / grid.cols) | 0;
  const maxR = Math.max(grid.cols, grid.rows);
  for (let r = 1; r < maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = sx + dx;
        const y = sy + dy;
        if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) continue;
        const i = y * grid.cols + x;
        if (grid.clearance[i] >= radius) return i;
      }
    }
  }
  return -1;
}

/**
 * Cells reachable from `start` without the clearance dropping below `radius`.
 *
 * The flood begins at the nearest point where the device actually *fits*, not
 * at the anchor itself. A wheelchair's centre can never sit in a doorway
 * threshold — it enters the room at the first point with room for it — so
 * seeding from the raw anchor would report that nothing in the room is
 * reachable at all.
 */
function reachableAtRadius(grid: ClearanceGrid, start: number, radius: number): Uint8Array {
  const seen = new Uint8Array(grid.cols * grid.rows);
  const seed = nearestCellWithClearance(grid, start, radius);
  if (seed === -1) return seen;
  const queue = [seed];
  seen[seed] = 1;
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head];
    const ux = u % grid.cols;
    const uy = (u / grid.cols) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const vx = ux + dx;
        const vy = uy + dy;
        if (vx < 0 || vy < 0 || vx >= grid.cols || vy >= grid.rows) continue;
        const v = vy * grid.cols + vx;
        if (seen[v] || grid.clearance[v] < radius) continue;
        seen[v] = 1;
        queue.push(v);
      }
    }
  }
  return seen;
}

/**
 * Ramer–Douglas–Peucker simplification.
 *
 * A raw grid path steps between cell centres, so drawn directly it reads as a
 * wobbling snake rather than a route a person would take. Simplifying to within
 * about one cell keeps the geometry honest while letting the drawn line look
 * like a line. This is presentation only — the bottleneck is measured on the
 * full-resolution path before this runs.
 */
function rdp(pts: { x: number; y: number }[], tol: number): { x: number; y: number }[] {
  if (pts.length < 3) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  let maxD = -1;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i].x - dx * pts[i].y + b.x * a.y - b.y * a.x) / len;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), tol).slice(0, -1), ...rdp(pts.slice(idx), tol)];
}

function simplify(grid: ClearanceGrid, path: number[]) {
  const pts = path.map((i) => cellToPoint(grid, i));
  if (pts.length <= 2) return pts;
  return rdp(pts, grid.cellSize * 3);
}

export interface CheckOptions {
  cellSize?: number;
}

/**
 * The one function the rest of the app calls.
 *
 * Returns every violation found, the routes it searched (so they can be drawn
 * and the wheelchair animated along them), and the best turning circle
 * available in reachable space.
 */
export function checkClearance(
  room: Room,
  profile: MobilityProfile,
  options: CheckOptions = {},
): ClearanceResult {
  const t0 = performance.now();
  const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;
  const grid = buildGrid(room, cellSize);

  const violations: ClearanceViolation[] = [];
  const routes: RoutePath[] = [];

  const entry = room.anchors.find((a) => a.kind === 'entry');
  const destinations = room.anchors.filter((a) => a.kind === 'destination');

  let entryCell: number | null = null;
  if (entry) {
    entryCell = nearestFreeCell(grid, pointToCell(grid, entry.x, entry.y).index);
  }

  // ── Route checks ────────────────────────────────────────────────────────
  if (entryCell !== null && destinations.length > 0) {
    for (const dest of destinations) {
      const goalCell = nearestFreeCell(grid, pointToCell(grid, dest.x, dest.y).index);
      const exempt = approachZone(grid, entryCell, goalCell, profile.turningDiameter / 2);
      const res = widestPath(grid, entryCell, goalCell, exempt);

      if (!res.reached) {
        const at = cellToPoint(grid, goalCell);
        violations.push({
          type: 'unreachable',
          location: at,
          measured: 0,
          required: profile.minPathWidth,
          betweenAnchors: [entry!.id, dest.id],
          message: `No route at all from ${entry!.label} to ${dest.label} — the destination is fully enclosed.`,
        });
        routes.push({
          fromAnchorId: entry!.id,
          toAnchorId: dest.id,
          points: [],
          bottleneck: 0,
          bottleneckAt: at,
          passes: false,
        });
        continue;
      }

      const neck = routeBottleneck(grid, res.path, exempt);
      const bottleneckAt = cellToPoint(grid, neck.at);
      const passes = neck.width >= profile.minPathWidth;

      routes.push({
        fromAnchorId: entry!.id,
        toAnchorId: dest.id,
        points: simplify(grid, res.path),
        bottleneck: neck.width,
        bottleneckAt,
        passes,
      });

      if (!passes) {
        violations.push({
          type: 'path_width',
          location: bottleneckAt,
          measured: neck.width,
          required: profile.minPathWidth,
          betweenAnchors: [entry!.id, dest.id],
          message: `The widest route from ${entry!.label} to ${dest.label} narrows here.`,
        });
      }
    }
  }

  // ── Turning circle ──────────────────────────────────────────────────────
  const needRadius = profile.turningDiameter / 2;
  let turningCircle: TurningCircle | null = null;

  // Only somewhere you can actually get to counts as somewhere you can turn.
  const searchable =
    entryCell !== null
      ? reachableAtRadius(grid, entryCell, profile.minPathWidth / 2)
      : null;

  let bestIdx = -1;
  let bestClear = -1;
  for (let i = 0; i < grid.clearance.length; i++) {
    if (searchable && !searchable[i]) continue;
    if (grid.clearance[i] > bestClear) {
      bestClear = grid.clearance[i];
      bestIdx = i;
    }
  }

  // If nothing was reachable at full path width, fall back to the whole room
  // so the UI can still show the best circle that physically exists.
  if (bestIdx === -1) {
    for (let i = 0; i < grid.clearance.length; i++) {
      if (grid.clearance[i] > bestClear) {
        bestClear = grid.clearance[i];
        bestIdx = i;
      }
    }
  }

  if (bestIdx >= 0) {
    const diameter = bestClear * 2;
    const passes = diameter >= profile.turningDiameter;
    turningCircle = { centre: cellToPoint(grid, bestIdx), diameter, passes };
    if (!passes) {
      violations.push({
        type: 'turning_circle',
        location: turningCircle.centre,
        measured: diameter,
        required: profile.turningDiameter,
        message: 'The largest turning space in reach is too small to turn around in.',
      });
    }
  }

  return {
    violations,
    routes,
    turningCircle,
    passes: violations.length === 0,
    cellSize,
    computeMs: performance.now() - t0,
  };
}
