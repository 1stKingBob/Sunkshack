import type { MobilityProfile } from './types';

/**
 * Every figure here is sourced. Nothing in this file is a number we invented —
 * if you change one, change the `source` string with it.
 *
 * AS 1428.1 is the Australian standard for design for access and mobility.
 * ADA figures are included for comparison / international demos.
 */
export const PROFILES: MobilityProfile[] = [
  {
    id: 'as1428-manual',
    name: 'Manual wheelchair — AS 1428.1',
    turningDiameter: 1540,
    minPathWidth: 1000,
    source: 'AS 1428.1 (AU): 1000 mm minimum unobstructed path; 1540 mm turning width',
    note: 'A full 180° turn wants 2070 mm in the direction of travel — this checks the 1540 mm circle.',
  },
  {
    id: 'as1428-passing',
    name: 'Two wheelchairs passing — AS 1428.1',
    turningDiameter: 1540,
    minPathWidth: 1800,
    source: 'AS 1428.1 (AU): 1800 mm allows two wheelchairs to pass',
    note: 'Use for shared or public spaces rather than a private bedroom.',
  },
  {
    id: 'ada-wheelchair',
    name: 'Wheelchair — ADA (US)',
    turningDiameter: 1525,
    minPathWidth: 915,
    source: 'ADA Standards: 60 in (1525 mm) turning space; 36 in (915 mm) clear width',
  },
  {
    id: 'walker',
    name: 'Walker / rollator',
    turningDiameter: 1200,
    minPathWidth: 900,
    source: 'Common design guidance — not a code minimum. Confirm against your local standard.',
    note: 'A walker needs less turning space than a wheelchair but still a continuous clear route.',
  },
];

export const DEFAULT_PROFILE_ID = 'as1428-manual';

export function getProfile(id: string): MobilityProfile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0];
}
