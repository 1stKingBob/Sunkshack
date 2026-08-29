/**
 * Display-only unit handling. The engine never sees anything but millimetres.
 */

export type UnitSystem = 'metric' | 'imperial';

const MM_PER_INCH = 25.4;

/** Format a mm length for display in the chosen system. */
export function formatLength(mm: number, system: UnitSystem): string {
  if (system === 'imperial') {
    const totalInches = mm / MM_PER_INCH;
    if (totalInches < 12) return `${totalInches.toFixed(1)}"`;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches - feet * 12);
    // 11.6" rounds to 12" — roll it up rather than print 5'12"
    if (inches === 12) return `${feet + 1}′ 0″`;
    return `${feet}′ ${inches}″`;
  }
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m`;
  return `${Math.round(mm)} mm`;
}

/** Compact form for dimension callouts, where space is tight. */
export function formatCallout(mm: number, system: UnitSystem): string {
  if (system === 'imperial') {
    const inches = mm / MM_PER_INCH;
    return `${inches.toFixed(0)}″`;
  }
  return `${Math.round(mm)}`;
}

export function unitSuffix(system: UnitSystem): string {
  return system === 'imperial' ? 'in' : 'mm';
}

/** Parse a user-typed number in their display unit back into mm. */
export function parseToMm(value: number, system: UnitSystem): number {
  return system === 'imperial' ? value * MM_PER_INCH : value;
}

/** Convert mm into the user's display unit for populating an input field. */
export function fromMm(mm: number, system: UnitSystem): number {
  return system === 'imperial' ? mm / MM_PER_INCH : mm;
}
