import type { FurnitureItem, FurnitureType, Room } from '../types';
import { FURNITURE, makeItem } from '../data/furniture';

export interface RawDetection {
  type: string;
  confidence: number;
  fx?: number;
  fy?: number;
  rotation?: 0 | 90 | 180 | 270;
  sizeHint?: string;
}

function asType(t: string): FurnitureType {
  return (t in FURNITURE ? t : 'other') as FurnitureType;
}

function applySizeHint(item: FurnitureItem, hint?: string) {
  if (!hint) return;
  const spec = FURNITURE[item.type];
  const v = spec.variants?.find((x) => x.label.toLowerCase() === hint.toLowerCase());
  if (v) {
    item.width = v.width;
    item.depth = v.depth;
  }
}

function clampInside(item: FurnitureItem, room: Room) {
  const swapped = item.rotation === 90 || item.rotation === 270;
  const w = swapped ? item.depth : item.width;
  const d = swapped ? item.width : item.depth;
  item.x = Math.min(room.width - w / 2, Math.max(w / 2, item.x));
  item.y = Math.min(room.depth - d / 2, Math.max(d / 2, item.y));
}

/** Axis-aligned overlap test on current footprints. */
function overlaps(a: FurnitureItem, b: FurnitureItem): boolean {
  const fa = footprintOf(a);
  const fb = footprintOf(b);
  return !(fa.maxX <= fb.minX || fa.minX >= fb.maxX || fa.maxY <= fb.minY || fa.minY >= fb.maxY);
}

function footprintOf(i: FurnitureItem) {
  const swapped = i.rotation === 90 || i.rotation === 270;
  const w = swapped ? i.depth : i.width;
  const d = swapped ? i.width : i.depth;
  return { minX: i.x - w / 2, maxX: i.x + w / 2, minY: i.y - d / 2, maxY: i.y + d / 2, w, d };
}

/**
 * THE CLUMP TRAP.
 *
 * If every recognised object lands at the same default coordinate the user
 * spends the first thirty seconds untangling a pile, which is exactly the
 * moment a demo loses the room. Anything without a usable estimated position
 * gets placed the way furniture actually gets placed: big things against the
 * nearest wall, nightstands beside the bed, everything else toward the middle —
 * then nudged until nothing is inside anything else.
 */
function heuristicPlace(item: FurnitureItem, room: Room, placed: FurnitureItem[]) {
  const spec = FURNITURE[item.type];

  if (spec.placement === 'beside-bed') {
    const bed = placed.find((p) => p.type === 'bed');
    if (bed) {
      const f = footprintOf(bed);
      item.x = f.maxX + item.width / 2 + 60;
      item.y = f.minY + item.depth / 2;
      clampInside(item, room);
      if (!placed.some((p) => overlaps(item, p))) return;
      item.x = f.minX - item.width / 2 - 60;
      clampInside(item, room);
      if (!placed.some((p) => overlaps(item, p))) return;
    }
  }

  if (spec.placement === 'wall') {
    // try each wall, longest-first, at the first free slot along it
    const walls: ('north' | 'south' | 'west' | 'east')[] =
      room.width >= room.depth ? ['north', 'south', 'west', 'east'] : ['west', 'east', 'north', 'south'];
    for (const wall of walls) {
      const along = wall === 'north' || wall === 'south' ? room.width : room.depth;
      const steps = Math.max(1, Math.floor(along / 200));
      for (let s = 0; s <= steps; s++) {
        const t = (s / steps) * along;
        if (wall === 'north') {
          item.rotation = 0;
          item.x = t;
          item.y = item.depth / 2 + 20;
        } else if (wall === 'south') {
          item.rotation = 0;
          item.x = t;
          item.y = room.depth - item.depth / 2 - 20;
        } else if (wall === 'west') {
          item.rotation = 90;
          item.x = item.depth / 2 + 20;
          item.y = t;
        } else {
          item.rotation = 90;
          item.x = room.width - item.depth / 2 - 20;
          item.y = t;
        }
        clampInside(item, room);
        if (!placed.some((p) => overlaps(item, p))) return;
      }
    }
  }

  // centre, then spiral out until it fits
  item.x = room.width / 2;
  item.y = room.depth / 2;
  clampInside(item, room);
  if (!placed.some((p) => overlaps(item, p))) return;

  for (let r = 200; r < Math.max(room.width, room.depth); r += 200) {
    for (let a = 0; a < 12; a++) {
      const th = (a / 12) * Math.PI * 2;
      item.x = room.width / 2 + Math.cos(th) * r;
      item.y = room.depth / 2 + Math.sin(th) * r;
      clampInside(item, room);
      if (!placed.some((p) => overlaps(item, p))) return;
    }
  }
}

/**
 * Turn detections into placed furniture.
 *
 * Where the model gave a plan position we use it — scaled by the room
 * dimensions the user typed, which is the one real measurement in the whole
 * pipeline and the reason the output is in millimetres rather than in
 * arbitrary units. Where it did not, we fall back to the heuristic above.
 * Either way size comes from a standard-size table and never from pixels.
 */
export function placeDetections(detections: RawDetection[], room: Room): FurnitureItem[] {
  const placed: FurnitureItem[] = [];

  // Beds first: nightstands want to sit beside one, so it must already exist.
  const ordered = [...detections].sort((a, b) => {
    const rank = (t: string) => (t === 'bed' ? 0 : FURNITURE[asType(t)].placement === 'wall' ? 1 : 2);
    return rank(a.type) - rank(b.type);
  });

  for (const d of ordered) {
    const type = asType(d.type);
    const item = makeItem(type, 0, 0, d.fx !== undefined ? 'estimated' : 'default');
    item.rotation = d.rotation ?? 0;
    applySizeHint(item, d.sizeHint);

    if (d.fx !== undefined && d.fy !== undefined) {
      item.x = d.fx * room.width;
      item.y = d.fy * room.depth;
      clampInside(item, room);
      // Even an estimated position gets nudged if it lands inside something
      // else — two solid objects cannot occupy the same floor.
      if (placed.some((p) => overlaps(item, p))) {
        heuristicPlace(item, room, placed);
        item.provenance = 'default';
      }
    } else {
      heuristicPlace(item, room, placed);
    }

    placed.push(item);
  }

  return placed;
}
