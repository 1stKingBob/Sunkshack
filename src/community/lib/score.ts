import type { WeaveReport } from '../types';

/**
 * Turn a Weave clearance report into a single 0–10 accessibility score.
 *
 * Each check (a route, or the turning circle) is scored on how much margin
 * it has over the minimum required, not just pass/fail — a corridor that
 * exactly meets the minimum is real but tight, so it lands mid-scale rather
 * than at the top:
 *
 *   ratio = measured / required
 *   ratio ≤ 0.5  → 0    (badly short, or no route at all)
 *   ratio = 1.0  → 5    (meets the minimum, no margin)
 *   ratio ≥ 1.5  → 10   (comfortable margin)
 *
 * linearly interpolated between those points. The building's score is the
 * mean of every check's score, rounded to one decimal. This is a judgement
 * call, not a standard — it exists so a search filter has a number to sort
 * on, not as a substitute for reading the underlying report.
 */
export function scoreReport(report: WeaveReport): number {
  const checks = scoreChecks(report);
  if (checks.length === 0) return 0;
  const mean = checks.reduce((sum, c) => sum + c.score, 0) / checks.length;
  return Math.round(mean * 10) / 10;
}

export interface ScoredCheck {
  label: string;
  score: number;
  measuredMm: number;
  requiredMm: number;
}

export function scoreChecks(report: WeaveReport): ScoredCheck[] {
  const checks: ScoredCheck[] = report.routes.map((r) => ({
    label: r.label,
    score: ratioToScore(r.requiredMm > 0 ? r.measuredMm / r.requiredMm : 0),
    measuredMm: r.measuredMm,
    requiredMm: r.requiredMm,
  }));

  if (report.turning) {
    checks.push({
      label: 'Turning space',
      score: ratioToScore(
        report.turning.requiredMm > 0 ? report.turning.diameterMm / report.turning.requiredMm : 0,
      ),
      measuredMm: report.turning.diameterMm,
      requiredMm: report.turning.requiredMm,
    });
  }

  return checks;
}

function ratioToScore(ratio: number): number {
  const clamped = Math.max(0, Math.min(1.5, ratio));
  if (clamped <= 0.5) return 0;
  if (clamped <= 1) return ((clamped - 0.5) / 0.5) * 5;
  return 5 + ((clamped - 1) / 0.5) * 5;
}
