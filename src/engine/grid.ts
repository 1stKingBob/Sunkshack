import type { FurnitureItem, Room } from '../types';

/**
 * Grid resolution in mm. This sets how finely routes are searched — it does
 * NOT set measurement precision, because clearance is computed analytically
 * rather than by counting cells (see buildGrid).
 */
export const DEFAULT_CELL_SIZE = 40;

export interface ClearanceGrid {
  cols: number;
  rows: number;
  cellSize: number;
  /** 1 = occupied by furniture */
  blocked: Uint8Array;
  /**
   * mm of free space around each cell centre — the radius of the largest
   * circle centred there that touches neither furniture nor a wall.
   */
  clearance: Float64Array;
}

/** The axis-aligned footprint of an item after its rotation is applied. */
export function footprint(item: FurnitureItem) {
  const swapped = item.rotation === 90 || item.rotation === 270;
  const w = swapped ? item.depth : item.width;
  const d = swapped ? item.width : item.depth;
  return {
    minX: item.x - w / 2,
    maxX: item.x + w / 2,
    minY: item.y - d / 2,
    maxY: item.y + d / 2,
    w,
    d,
  };
}

/** Exact distance from a point to an axis-aligned rectangle. 0 if inside. */
function distToRect(
  px: number,
  py: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): number {
  const dx = Math.max(minX - px, 0, px - maxX);
  const dy = Math.max(minY - py, 0, py - maxY);
  return dx === 0 ? dy : dy === 0 ? dx : Math.hypot(dx, dy);
}

/**
 * Build the clearance field.
 *
 * Clearance is computed ANALYTICALLY, not by counting grid cells. Furniture
 * footprints are axis-aligned rectangles and walls are straight lines, so the
 * exact distance from any point to the nearest obstacle is a closed-form
 * expression — and with a handful of items it is cheap enough to just evaluate
 * everywhere.
 *
 * This matters more than it might look. A rasterised distance transform has to
 * round furniture outward to whole cells and then correct back by half a cell,
 * and those two errors do not cancel: on a 50 mm grid it under-reported a real
 * 735 mm gap as 650 mm. For a tool whose entire claim is "we give you the
 * actual number", an 85 mm systematic error in the headline figure is not a
 * rounding detail, it is the product being wrong. Going analytic removes it.
 *
 * The grid still exists — it is what the route search walks over — but its
 * resolution now only affects how finely a path can wiggle, not what any
 * measurement says.
 */
export function buildGrid(room: Room, cellSize = DEFAULT_CELL_SIZE): ClearanceGrid {
  const cols = Math.max(1, Math.ceil(room.width / cellSize));
  const rows = Math.max(1, Math.ceil(room.depth / cellSize));
  const n = cols * rows;
  const blocked = new Uint8Array(n);
  const clearance = new Float64Array(n);

  const rects = room.furniture.map((item) => {
    const f = footprint(item);
    return f;
  });

  for (let y = 0; y < rows; y++) {
    const cy = (y + 0.5) * cellSize;
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const cx = (x + 0.5) * cellSize;

      let best = Math.min(cx, cy, room.width - cx, room.depth - cy);
      for (let k = 0; k < rects.length; k++) {
        const r = rects[k];
        const d = distToRect(cx, cy, r.minX, r.minY, r.maxX, r.maxY);
        if (d < best) best = d;
        if (best === 0) break;
      }

      if (best <= 0) {
        blocked[i] = 1;
        clearance[i] = 0;
      } else {
        clearance[i] = best;
      }
    }
  }

  return { cols, rows, cellSize, blocked, clearance };
}

/** mm point → grid index, clamped into the room. */
export function pointToCell(
  grid: ClearanceGrid,
  x: number,
  y: number,
): { cx: number; cy: number; index: number } {
  const cx = Math.min(grid.cols - 1, Math.max(0, Math.floor(x / grid.cellSize)));
  const cy = Math.min(grid.rows - 1, Math.max(0, Math.floor(y / grid.cellSize)));
  return { cx, cy, index: cy * grid.cols + cx };
}

/** Grid index → the mm coordinate of that cell's centre. */
export function cellToPoint(grid: ClearanceGrid, index: number) {
  const cx = index % grid.cols;
  const cy = Math.floor(index / grid.cols);
  return { x: (cx + 0.5) * grid.cellSize, y: (cy + 0.5) * grid.cellSize };
}

/**
 * An anchor dropped on top of furniture (a bed's edge, a door swing) would be
 * unroutable. Snap it to the nearest cell with any free space, so the user
 * gets a sensible answer instead of a spurious "unreachable".
 */
export function nearestFreeCell(grid: ClearanceGrid, index: number): number {
  if (grid.clearance[index] > 0) return index;
  const startX = index % grid.cols;
  const startY = Math.floor(index / grid.cols);
  const maxR = Math.max(grid.cols, grid.rows);

  for (let r = 1; r < maxR; r++) {
    let best = -1;
    let bestClear = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = startX + dx;
        const y = startY + dy;
        if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) continue;
        const i = y * grid.cols + x;
        if (grid.clearance[i] > bestClear) {
          bestClear = grid.clearance[i];
          best = i;
        }
      }
    }
    if (best >= 0) return best;
  }
  return index;
}
