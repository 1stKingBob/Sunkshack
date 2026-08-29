import { describe, expect, it } from 'vitest';
import { checkClearance } from './clearance';
import { buildGrid, pointToCell } from './grid';
import type { AnchorPoint, FurnitureItem, MobilityProfile, Room } from '../types';

const PROFILE: MobilityProfile = {
  id: 'test',
  name: 'Test profile',
  turningDiameter: 1540,
  minPathWidth: 1000,
  source: 'AS 1428.1',
};

let seq = 0;
function item(
  type: FurnitureItem['type'],
  x: number,
  y: number,
  width: number,
  depth: number,
): FurnitureItem {
  return {
    id: `f${seq++}`,
    type,
    x,
    y,
    width,
    depth,
    height: 600,
    rotation: 0,
    provenance: 'user',
  };
}

function anchor(kind: AnchorPoint['kind'], label: string, x: number, y: number): AnchorPoint {
  return { id: `a${seq++}`, kind, label, x, y };
}

function room(width: number, depth: number, furniture: FurnitureItem[], anchors: AnchorPoint[]): Room {
  return { width, depth, furniture, anchors };
}

describe('distance field', () => {
  it('measures clearance to a wall correctly at the room centre', () => {
    // Empty 4000 × 4000 room: the centre is 2000 mm from every wall.
    const grid = buildGrid(room(4000, 4000, [], []));
    const { index } = pointToCell(grid, 2000, 2000);
    expect(grid.clearance[index]).toBeGreaterThan(1900);
    expect(grid.clearance[index]).toBeLessThanOrEqual(2000);
  });

  it('reports zero clearance inside furniture', () => {
    const grid = buildGrid(room(4000, 4000, [item('bed', 2000, 2000, 1500, 2000)], []));
    const { index } = pointToCell(grid, 2000, 2000);
    expect(grid.clearance[index]).toBe(0);
  });
});

describe('an empty room passes', () => {
  it('finds a route and a turning circle with nothing in the way', () => {
    const r = room(
      4000,
      4000,
      [],
      [anchor('entry', 'Door', 200, 200), anchor('destination', 'Window', 3800, 3800)],
    );
    const res = checkClearance(r, PROFILE);
    expect(res.passes).toBe(true);
    expect(res.routes).toHaveLength(1);
    expect(res.routes[0].passes).toBe(true);
    expect(res.turningCircle?.passes).toBe(true);
  });
});

describe('a genuinely blocked route fails', () => {
  it('flags a wall of furniture sealing off the destination', () => {
    // A 3600 mm slab across a 4000 mm room, leaving only 400 mm at one end.
    const r = room(
      4000,
      5000,
      [item('wardrobe', 1800, 2500, 3600, 600)],
      [anchor('entry', 'Door', 2000, 400), anchor('destination', 'Bed side', 2000, 4600)],
    );
    const res = checkClearance(r, PROFILE);
    expect(res.passes).toBe(false);
    const route = res.routes[0];
    // A route exists through the 400 mm gap, but nowhere near wide enough.
    expect(route.bottleneck).toBeLessThan(PROFILE.minPathWidth);
    expect(res.violations.some((v) => v.type === 'path_width' || v.type === 'unreachable')).toBe(true);
  });
});

describe('THE EMERGENT CASE — the whole reason this product exists', () => {
  /**
   * Two pieces of furniture, each against a different wall, each leaving
   * plenty of room on its own. Only the gap *between them* fails — which is
   * exactly the failure a person cannot see by eye, because you are never
   * looking at both pieces and the space between them at once.
   */
  const ROOM_W = 3000;
  const ROOM_D = 5000;
  const anchors = [
    anchor('entry', 'Door', 1500, 300),
    anchor('destination', 'Bed side', 1500, 4700),
  ];

  // Against the west wall, 900 mm deep. Leaves 2100 mm of room beside it.
  const dresser = () => item('dresser', 450, 2500, 900, 1200);
  // Against the east wall, 1600 mm deep. Leaves 1400 mm of room beside it.
  const bookcase = () => item('bookcase', 2200, 2500, 1600, 400);

  it('passes with only the dresser', () => {
    const res = checkClearance(room(ROOM_W, ROOM_D, [dresser()], anchors), PROFILE);
    expect(res.routes[0].bottleneck).toBeGreaterThanOrEqual(PROFILE.minPathWidth);
    expect(res.routes[0].passes).toBe(true);
  });

  it('passes with only the bookcase', () => {
    const res = checkClearance(room(ROOM_W, ROOM_D, [bookcase()], anchors), PROFILE);
    expect(res.routes[0].bottleneck).toBeGreaterThanOrEqual(PROFILE.minPathWidth);
    expect(res.routes[0].passes).toBe(true);
  });

  it('FAILS with both, though neither is at fault alone', () => {
    const res = checkClearance(room(ROOM_W, ROOM_D, [dresser(), bookcase()], anchors), PROFILE);
    const route = res.routes[0];
    // 3000 − 900 − 1600 = 500 mm left between them. Half of what's needed.
    expect(route.passes).toBe(false);
    expect(route.bottleneck).toBeLessThan(PROFILE.minPathWidth);
    expect(route.bottleneck).toBeGreaterThan(0);

    const v = res.violations.find((x) => x.type === 'path_width');
    expect(v).toBeDefined();
    // The flag must land in the gap between them, not on either piece.
    expect(v!.location.y).toBeGreaterThan(1800);
    expect(v!.location.y).toBeLessThan(3200);
  });
});

describe('turning circle', () => {
  it('fails in a corridor too narrow to turn around in', () => {
    // 1200 mm wide: wide enough to travel down, too tight for a 1540 mm turn.
    const r = room(
      1200,
      5000,
      [],
      [anchor('entry', 'Door', 600, 300), anchor('destination', 'End', 600, 4700)],
    );
    const res = checkClearance(r, PROFILE);
    expect(res.routes[0].passes).toBe(true); // travel is fine
    expect(res.turningCircle?.passes).toBe(false); // turning is not
    expect(res.violations.some((v) => v.type === 'turning_circle')).toBe(true);
  });

  it('reports a plausible diameter for the space it found', () => {
    const r = room(4000, 4000, [], [anchor('entry', 'Door', 200, 200)]);
    const res = checkClearance(r, PROFILE);
    // Best circle in a 4 m square room is ~4000 mm across.
    expect(res.turningCircle!.diameter).toBeGreaterThan(3500);
    expect(res.turningCircle!.diameter).toBeLessThanOrEqual(4000);
  });
});

describe('robustness', () => {
  it('does not crash with no anchors', () => {
    const res = checkClearance(room(3000, 3000, [item('bed', 1500, 1500, 1500, 2000)], []), PROFILE);
    expect(res.routes).toHaveLength(0);
    expect(res.turningCircle).not.toBeNull();
  });

  it('snaps an anchor dropped on top of furniture to free space', () => {
    const r = room(
      4000,
      4000,
      [item('bed', 2000, 2000, 1500, 2000)],
      // entry deliberately placed inside the bed
      [anchor('entry', 'Door', 2000, 2000), anchor('destination', 'Corner', 3800, 3800)],
    );
    const res = checkClearance(r, PROFILE);
    expect(res.routes[0].points.length).toBeGreaterThan(0);
  });

  it('is fast enough to run on every frame of a drag', () => {
    const furniture = Array.from({ length: 8 }, (_, i) =>
      item('other', 500 + (i % 4) * 900, 500 + Math.floor(i / 4) * 1500, 600, 600),
    );
    const r = room(
      5000,
      4000,
      furniture,
      [anchor('entry', 'Door', 200, 200), anchor('destination', 'Far', 4800, 3800)],
    );
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) checkClearance(r, PROFILE);
    const perRun = (performance.now() - t0) / 20;
    expect(perRun).toBeLessThan(16); // one 60fps frame
  });
});
