/**
 * Weave Community — shared types.
 *
 * UNITS: lengths that came from a Weave room-check report stay in
 * millimetres, matching the main app's contract (see the root project's
 * src/types.ts). This app does not do its own clearance maths — it only
 * scores reports that were already computed there.
 */

/** One route Weave checked, as exported from the Care Pass. */
export interface ReportRoute {
  label: string;
  measuredMm: number;
  requiredMm: number;
  passes: boolean;
}

export interface ReportTurning {
  diameterMm: number;
  requiredMm: number;
  passes: boolean;
}

/**
 * The report format the main Weave app exports from its Care Pass (see
 * ../../src/ui/CarePass.tsx `buildReport`). Kept as a plain, versioned JSON
 * shape rather than a shared import so this app has zero build-time
 * dependency on the root app's source tree.
 */
export interface WeaveReport {
  weaveReport: 1;
  generatedAt: string;
  profileId: string;
  profileName: string;
  profileSource: string;
  roomWidthMm: number;
  roomDepthMm: number;
  routes: ReportRoute[];
  turning: ReportTurning | null;
  passes: boolean;
  furnitureCount: number;
}

export function isWeaveReport(value: unknown): value is WeaveReport {
  return !!value && typeof value === 'object' && (value as { weaveReport?: unknown }).weaveReport === 1;
}

/** A building as stored in Supabase, keyed by Google's place_id. */
export interface Building {
  placeId: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  category: string | null;
}

/** A building with its aggregated community score (from building_scores view). */
export interface BuildingScore extends Building {
  avgScore: number;
  reportCount: number;
  lastReportedAt: string;
}

/** One submitted accessibility report, as read back from Supabase. */
export interface StoredReport {
  id: string;
  placeId: string;
  score: number;
  profileId: string;
  profileName: string;
  roomWidthMm: number | null;
  roomDepthMm: number | null;
  routes: ReportRoute[];
  turning: ReportTurning | null;
  passes: boolean;
  note: string | null;
  createdAt: string;
}

/** A Google Places result merged with whatever score data we have for it. */
export interface PlaceCandidate {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string | null;
  googleRating: number | null;
  distanceM: number | null;
  score: BuildingScore | null;
}
