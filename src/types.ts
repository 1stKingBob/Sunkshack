/**
 * Weave — shared data contract.
 *
 * UNITS: every length in this file is **millimetres**, stored as a plain number.
 * There is exactly one canonical unit in the entire codebase so that no
 * conversion can hide in the middle of the maths. Imperial is a *display*
 * concern only — see src/units.ts. Never store feet or inches in these shapes.
 */

export type FurnitureType =
  | 'bed'
  | 'dresser'
  | 'nightstand'
  | 'wardrobe'
  | 'table'
  | 'chair'
  | 'sofa'
  | 'desk'
  | 'bookcase'
  | 'other';

export type Rotation = 0 | 90 | 180 | 270;

export interface FurnitureItem {
  id: string;
  type: FurnitureType;
  label?: string;
  /** mm, from the room's left (west) wall to the item's centre */
  x: number;
  /** mm, from the room's top (north) wall to the item's centre */
  y: number;
  /** mm, the item's extent along its own local X before rotation */
  width: number;
  /** mm, the item's extent along its own local Y before rotation */
  depth: number;
  /** mm, visual height only — never used in clearance maths */
  height: number;
  rotation: Rotation;
  /**
   * How this item's position was arrived at. Drives the "confirm this" UI:
   * an estimate must never be presented with the same confidence as a
   * measurement the user typed or a position they dragged themselves.
   */
  provenance: 'user' | 'estimated' | 'default';
}

export type AnchorKind = 'entry' | 'destination';

export interface AnchorPoint {
  id: string;
  label: string;
  kind: AnchorKind;
  /** mm */
  x: number;
  /** mm */
  y: number;
}

export interface Room {
  /** mm, wall to wall, west→east */
  width: number;
  /** mm, wall to wall, north→south */
  depth: number;
  furniture: FurnitureItem[];
  anchors: AnchorPoint[];
}

export interface MobilityProfile {
  id: string;
  name: string;
  /** mm — the diameter of the circle the device needs to turn around in */
  turningDiameter: number;
  /** mm — minimum unobstructed width of a route */
  minPathWidth: number;
  /** Where these numbers come from, shown in the UI so no figure is unsourced */
  source: string;
  note?: string;
}

export interface ClearanceViolation {
  type: 'path_width' | 'turning_circle' | 'unreachable';
  /** mm — where to draw the flag */
  location: { x: number; y: number };
  /** mm — what we actually measured. 0 for a fully blocked route. */
  measured: number;
  /** mm — what the active profile requires */
  required: number;
  /** path_width / unreachable only: which two anchors this route connects */
  betweenAnchors?: [string, string];
  message: string;
}

/** A route the engine found, in mm coordinates, for drawing + animation. */
export interface RoutePath {
  fromAnchorId: string;
  toAnchorId: string;
  /** mm waypoints, start → end */
  points: { x: number; y: number }[];
  /** mm — the narrowest clearance anywhere along this route */
  bottleneck: number;
  /** mm — where that narrowest point is */
  bottleneckAt: { x: number; y: number };
  passes: boolean;
}

/** The best turning circle the engine could fit in reachable space. */
export interface TurningCircle {
  centre: { x: number; y: number };
  /** mm */
  diameter: number;
  passes: boolean;
}

export interface ClearanceResult {
  violations: ClearanceViolation[];
  routes: RoutePath[];
  turningCircle: TurningCircle | null;
  passes: boolean;
  /** Grid cell size actually used, mm — surfaced so the UI can state precision */
  cellSize: number;
  /** ms — surfaced because "recomputed in under a millisecond" is a real claim */
  computeMs: number;
}

/** What the vision model returns for one thing it saw in the photo. */
export interface DetectedItem {
  type: FurnitureType;
  confidence: number;
  /** Normalised 0–1 bounding box in the source image, if the model gave one */
  box?: { x: number; y: number; w: number; h: number };
}

export interface AnalysisResult {
  items: DetectedItem[];
  /** Relative depth map, row-major, normalised 0–1. Undefined if unavailable. */
  depth?: { width: number; height: number; data: number[] };
  /** Which path actually ran — surfaced honestly in the UI, never hidden. */
  mode: 'calibrated' | 'identified-only' | 'fallback';
  warnings: string[];
}
