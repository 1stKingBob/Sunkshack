import type { FurnitureItem, FurnitureType } from '../types';

export interface SizeVariant {
  label: string;
  width: number;
  depth: number;
}

export interface FurnitureSpec {
  label: string;
  /** mm — the size assumed when we have identification but no measurement */
  width: number;
  depth: number;
  height: number;
  /** One-tap corrections. We never guess size from pixels; the user confirms. */
  variants?: SizeVariant[];
  /** Where this item naturally sits, used by the placement heuristic */
  placement: 'wall' | 'beside-bed' | 'centre';
}

/** Australian standard mattress sizes; other figures are common retail sizes. */
export const FURNITURE: Record<FurnitureType, FurnitureSpec> = {
  bed: {
    label: 'Bed',
    width: 1530,
    depth: 2030,
    height: 600,
    placement: 'wall',
    variants: [
      { label: 'Single', width: 920, depth: 1870 },
      { label: 'Double', width: 1370, depth: 1870 },
      { label: 'Queen', width: 1530, depth: 2030 },
      { label: 'King', width: 1830, depth: 2030 },
    ],
  },
  dresser: {
    label: 'Dresser',
    width: 900,
    depth: 450,
    height: 800,
    placement: 'wall',
    variants: [
      { label: 'Narrow', width: 600, depth: 400 },
      { label: 'Standard', width: 900, depth: 450 },
      { label: 'Wide', width: 1400, depth: 500 },
    ],
  },
  nightstand: {
    label: 'Nightstand',
    width: 450,
    depth: 400,
    height: 550,
    placement: 'beside-bed',
  },
  wardrobe: {
    label: 'Wardrobe',
    width: 1200,
    depth: 600,
    height: 2000,
    placement: 'wall',
    variants: [
      { label: '2-door', width: 900, depth: 600 },
      { label: '3-door', width: 1200, depth: 600 },
      { label: '4-door', width: 1800, depth: 600 },
    ],
  },
  table: { label: 'Table', width: 1200, depth: 800, height: 750, placement: 'centre' },
  chair: { label: 'Chair', width: 450, depth: 450, height: 900, placement: 'centre' },
  sofa: { label: 'Sofa', width: 2000, depth: 900, height: 850, placement: 'wall' },
  desk: { label: 'Desk', width: 1400, depth: 700, height: 750, placement: 'wall' },
  bookcase: { label: 'Bookcase', width: 800, depth: 300, height: 1800, placement: 'wall' },
  other: { label: 'Object', width: 600, depth: 600, height: 700, placement: 'centre' },
};

let counter = 0;
export function makeItem(
  type: FurnitureType,
  x: number,
  y: number,
  provenance: FurnitureItem['provenance'] = 'default',
): FurnitureItem {
  const spec = FURNITURE[type];
  counter += 1;
  return {
    id: `${type}-${counter}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    x,
    y,
    width: spec.width,
    depth: spec.depth,
    height: spec.height,
    rotation: 0,
    provenance,
  };
}
