import type { WeaveReport } from '../types';

/**
 * Extra clearance required on top of the raw AS 1428.1 / ADA minimum before a
 * report counts as accessible for the community. A route or turning circle
 * that only just clears the code minimum is real but has zero headroom for
 * measurement error, a wider chair, or someone who just isn't a confident
 * driver — this margin is what keeps a 1001 mm corridor against a 1000 mm
 * requirement from reading the same as a comfortable 1300 mm one.
 */
export const ACCESS_MARGIN_MM = 150;

export interface ScoredCheck {
  label: string;
  measuredMm: number;
  requiredMm: number;
  /** Meets the code minimum exactly — what the room-check screen calls a pass. */
  passes: boolean;
  /** Meets the code minimum with ACCESS_MARGIN_MM to spare — what the community badge requires. */
  clearsMargin: boolean;
}

export function scoreChecks(report: WeaveReport, marginMm: number = ACCESS_MARGIN_MM): ScoredCheck[] {
  const checks: ScoredCheck[] = report.routes.map((r) => ({
    label: r.label,
    measuredMm: r.measuredMm,
    requiredMm: r.requiredMm,
    passes: r.measuredMm >= r.requiredMm,
    clearsMargin: r.measuredMm >= r.requiredMm + marginMm,
  }));

  if (report.turning) {
    checks.push({
      label: 'Turning space',
      measuredMm: report.turning.diameterMm,
      requiredMm: report.turning.requiredMm,
      passes: report.turning.diameterMm >= report.turning.requiredMm,
      clearsMargin: report.turning.diameterMm >= report.turning.requiredMm + marginMm,
    });
  }

  return checks;
}

/**
 * Whether a report counts as wheelchair-accessible for the community map:
 * every route and the turning circle must clear the code minimum by
 * ACCESS_MARGIN_MM, not just meet it. A report with no checks at all never
 * counts as accessible.
 */
export function isAccessible(report: WeaveReport, marginMm: number = ACCESS_MARGIN_MM): boolean {
  const checks = scoreChecks(report, marginMm);
  return checks.length > 0 && checks.every((c) => c.clearsMargin);
}
