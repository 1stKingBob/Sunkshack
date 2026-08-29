import { createClient } from '@supabase/supabase-js';
import type { Building, BuildingScore, ReportRoute, ReportTurning, StoredReport, WeaveReport } from '../types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured ? createClient(url!, anonKey!) : null;

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

/** Buildings with at least one report, restricted to a set of place_ids (a search result page). */
export async function fetchScoresForPlaces(placeIds: string[]): Promise<Map<string, BuildingScore>> {
  if (placeIds.length === 0) return new Map();
  const { data, error } = await requireClient()
    .from('building_scores')
    .select('*')
    .in('place_id', placeIds);
  if (error) throw error;
  const map = new Map<string, BuildingScore>();
  for (const row of data ?? []) {
    map.set(row.place_id, {
      placeId: row.place_id,
      name: row.name,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      category: row.category,
      avgScore: Number(row.avg_score),
      reportCount: Number(row.report_count),
      lastReportedAt: row.last_reported_at,
    });
  }
  return map;
}

export async function fetchReportsForPlace(placeId: string): Promise<StoredReport[]> {
  const { data, error } = await requireClient()
    .from('accessibility_reports')
    .select('*')
    .eq('place_id', placeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    placeId: row.place_id,
    score: Number(row.score),
    profileId: row.profile_id,
    profileName: row.profile_name,
    roomWidthMm: row.room_width_mm,
    roomDepthMm: row.room_depth_mm,
    routes: (row.routes ?? []) as ReportRoute[],
    turning: (row.turning ?? null) as ReportTurning | null,
    passes: row.passes,
    note: row.note,
    createdAt: row.created_at,
  }));
}

/** Upserts the building row, then inserts one report against it. */
export async function submitReport(
  building: Building,
  report: WeaveReport,
  score: number,
  note: string,
): Promise<void> {
  const client = requireClient();

  const { error: buildingError } = await client.from('buildings').upsert(
    {
      place_id: building.placeId,
      name: building.name,
      address: building.address,
      lat: building.lat,
      lng: building.lng,
      category: building.category,
    },
    { onConflict: 'place_id' },
  );
  if (buildingError) throw buildingError;

  const { error: reportError } = await client.from('accessibility_reports').insert({
    place_id: building.placeId,
    score,
    profile_id: report.profileId,
    profile_name: report.profileName,
    room_width_mm: report.roomWidthMm,
    room_depth_mm: report.roomDepthMm,
    routes: report.routes,
    turning: report.turning,
    passes: report.passes,
    note: note || null,
  });
  if (reportError) throw reportError;
}
