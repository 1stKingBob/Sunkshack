import { useState } from 'react';
import { formatLength, type UnitSystem } from '../units';

/**
 * The community view.
 *
 * Deliberately NOT a review feed. An accessibility claim is only worth
 * something if it is backed by a measurement — "it seemed fine to me" is how
 * people end up stranded at a door — so an entry here is a published Care Pass:
 * a room someone actually measured, with the figures and the profile it was
 * checked against attached. That also gives an honest answer to the obvious
 * question of why anyone should trust it.
 *
 * Every entry below is fabricated sample data and is labelled as such on the
 * page. It shows the format; it is not a record of real places, and it does
 * not put words in the mouths of people who are not here to write them.
 */

interface Entry {
  id: string;
  place: string;
  kind: string;
  profile: string;
  routeWidth: number;
  turning: number;
  passes: boolean;
  checked: string;
  note: string;
}

const SAMPLE: Entry[] = [
  {
    id: 's1',
    place: 'Campus library — ground floor study room',
    kind: 'Study space',
    profile: 'Manual wheelchair — AS 1428.1',
    routeWidth: 1420,
    turning: 1780,
    passes: true,
    checked: '3 days ago',
    note: 'Clear once the loose chairs are pushed under the tables.',
  },
  {
    id: 's2',
    place: 'Share house — front bedroom',
    kind: 'Bedroom',
    profile: 'Manual wheelchair — AS 1428.1',
    routeWidth: 860,
    turning: 1610,
    passes: false,
    checked: '5 days ago',
    note: 'Turning space is fine; the route past the desk is the problem.',
  },
  {
    id: 's3',
    place: 'Community centre — meeting room B',
    kind: 'Meeting room',
    profile: 'Two wheelchairs passing — AS 1428.1',
    routeWidth: 1930,
    turning: 2040,
    passes: true,
    checked: '1 week ago',
    note: 'Measured with the table in its usual position.',
  },
  {
    id: 's4',
    place: 'Rental unit — bathroom approach',
    kind: 'Bathroom',
    profile: 'Walker / rollator',
    routeWidth: 910,
    turning: 1240,
    passes: true,
    checked: '1 week ago',
    note: 'Checked for a walker, not a wheelchair — a chair would not turn here.',
  },
  {
    id: 's5',
    place: 'Student accommodation — studio, level 3',
    kind: 'Studio',
    profile: 'Manual wheelchair — AS 1428.1',
    routeWidth: 740,
    turning: 1490,
    passes: false,
    checked: '2 weeks ago',
    note: 'Both measures short. Rearranging alone does not resolve it.',
  },
];

export function Community({ units }: { units: UnitSystem }) {
  const [filter, setFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const shown = SAMPLE.filter((e) =>
    filter === 'all' ? true : filter === 'pass' ? e.passes : !e.passes,
  );

  return (
    <div className="page">
      <div className="page-inner">
        <div className="sample-banner">
          <strong>Sample data.</strong> Weave has no live community yet — every entry below is
          fabricated to show the format. Real entries would come from published Care Passes, not
          from opinions.
        </div>

        <h1 className="page-title">Rooms people have measured</h1>
        <p className="page-lede">
          Not a review feed. Somebody said a place was accessible is not information; somebody
          measured 1420 mm of clear route and 1780 mm of turning space, against a named standard,
          is. Every entry here is a Care Pass its author chose to publish.
        </p>

        <div className="chips" style={{ marginBottom: 18 }}>
          {(['all', 'pass', 'fail'] as const).map((f) => (
            <button key={f} className="chip" data-on={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All rooms' : f === 'pass' ? 'Met the figures' : 'Fell short'}
            </button>
          ))}
        </div>

        <div className="entries">
          {shown.map((e) => (
            <article className="entry" key={e.id} data-ok={e.passes}>
              <div className="entry-head">
                <div>
                  <h3>{e.place}</h3>
                  <p className="entry-meta">
                    {e.kind} · checked against {e.profile} · {e.checked}
                  </p>
                </div>
                <span className="verdict" data-pass={e.passes}>
                  <span className="mark">{e.passes ? '✓' : '!'}</span>
                  {e.passes ? 'Met' : 'Short'}
                </span>
              </div>

              <div className="entry-figures">
                <div>
                  <dt>Narrowest route</dt>
                  <dd>{formatLength(e.routeWidth, units)}</dd>
                </div>
                <div>
                  <dt>Turning space</dt>
                  <dd>⌀ {formatLength(e.turning, units)}</dd>
                </div>
              </div>

              <p className="entry-note">{e.note}</p>
            </article>
          ))}
        </div>

        <div className="next-up">
          <h4>Where this goes</h4>
          <p>
            Published Care Passes accumulate into something no review site can offer: a map of
            places whose access has actually been measured, searchable by the profile you need
            rather than by a star rating. The honest limit is worth stating too — an entry only
            covers the room that was scanned, so a single unphotographed step at the entrance
            would not appear in it. Solving that properly is a design problem, not a feature flag.
          </p>
        </div>
      </div>
    </div>
  );
}
