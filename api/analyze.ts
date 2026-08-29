/**
 * Track C — server side.
 *
 * The API key lives here and only here. Calling a vision API straight from the
 * browser would put the key in the network tab of anyone who opened devtools,
 * and it would be scraped and billed within hours of going public.
 *
 * Degrades in three steps, and says which one it took rather than pretending:
 *   calibrated      — objects identified AND laid out, scaled by the typed width
 *   identified-only — we know what is in the room but not where
 *   fallback        — no model available; the client places by heuristic
 */

export interface AnalyzeRequest {
  /** data URL or bare base64 */
  image: string;
  /** mm — the one real-world measurement we trust, used to scale everything */
  roomWidth: number;
  roomDepth: number;
}

export interface AnalyzeResponse {
  items: {
    type: string;
    confidence: number;
    /** 0–1 across the room's width, from the left wall */
    fx?: number;
    /** 0–1 across the room's depth, from the far wall */
    fy?: number;
    rotation?: 0 | 90 | 180 | 270;
    sizeHint?: string;
  }[];
  mode: 'calibrated' | 'identified-only' | 'fallback';
  warnings: string[];
}

const TYPES = [
  'bed',
  'dresser',
  'nightstand',
  'wardrobe',
  'table',
  'chair',
  'sofa',
  'desk',
  'bookcase',
  'other',
];

const SYSTEM = `You are the perception step of an accessibility tool that checks whether a room has enough clear space for someone using a wheelchair or walker.

Given one photograph of a room, identify the significant floor-standing furniture and estimate a top-down floor plan.

Rules that matter:
- Only include furniture that SITS ON THE FLOOR and would obstruct movement. Ignore wall art, curtains, rugs, ceiling lights, and anything on top of another object.
- Do NOT estimate real-world sizes in metres or feet. You cannot know scale from a single photo, and a wrong size here corrupts the whole measurement. Report a size CATEGORY only where you are confident.
- fx/fy are positions on a top-down plan, each 0 to 1. fx = 0 is the left wall, fx = 1 the right wall. fy = 0 is the far wall (deepest in the photo), fy = 1 the near wall (closest to the camera). Give the CENTRE of each object.
- rotation is 0 if the object's long axis runs left-right in the plan, 90 if it runs near-far.
- If you cannot work out the layout, return the items with fx and fy omitted rather than guessing.

Return ONLY minified JSON, no prose, no code fence:
{"items":[{"type":"bed","confidence":0.9,"fx":0.3,"fy":0.4,"rotation":0,"sizeHint":"Queen"}]}
type must be one of: ${TYPES.join(', ')}`;

export async function analyze(body: AnalyzeRequest): Promise<AnalyzeResponse> {
  const warnings: string[] = [];
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return {
      items: [],
      mode: 'fallback',
      warnings: ['No ANTHROPIC_API_KEY configured — add one to .env.local to enable photo analysis.'],
    };
  }

  const raw = body.image.includes(',') ? body.image.split(',')[1] : body.image;
  const mediaMatch = /^data:(image\/[a-zA-Z+]+);/.exec(body.image);
  const mediaType = mediaMatch ? mediaMatch[1] : 'image/jpeg';

  let text: string;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: raw } },
              {
                type: 'text',
                text: 'Identify the floor-standing furniture and give the top-down plan positions.',
              },
            ],
          },
        ],
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return {
        items: [],
        mode: 'fallback',
        warnings: [`Vision API returned ${r.status}. ${detail.slice(0, 160)}`],
      };
    }

    const json = (await r.json()) as { content?: { type: string; text?: string }[] };
    text = (json.content ?? []).map((c) => c.text ?? '').join('').trim();
  } catch (err) {
    return {
      items: [],
      mode: 'fallback',
      warnings: [`Could not reach the vision API: ${(err as Error).message}`],
    };
  }

  // Models sometimes wrap JSON in a fence despite instructions.
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let parsed: AnalyzeResponse;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      items: [],
      mode: 'fallback',
      warnings: ['The vision model did not return usable JSON; placed by heuristic instead.'],
    };
  }

  const items = (parsed.items ?? [])
    .filter((i) => typeof i.type === 'string')
    .map((i) => ({
      type: TYPES.includes(i.type) ? i.type : 'other',
      confidence: typeof i.confidence === 'number' ? Math.min(1, Math.max(0, i.confidence)) : 0.5,
      fx: typeof i.fx === 'number' && i.fx >= 0 && i.fx <= 1 ? i.fx : undefined,
      fy: typeof i.fy === 'number' && i.fy >= 0 && i.fy <= 1 ? i.fy : undefined,
      rotation: ([0, 90, 180, 270] as const).includes(i.rotation as 0) ? i.rotation : 0,
      sizeHint: typeof i.sizeHint === 'string' ? i.sizeHint : undefined,
    }))
    .slice(0, 12);

  if (items.length === 0) {
    return { items: [], mode: 'fallback', warnings: ['No floor-standing furniture was recognised in that photo.'] };
  }

  const positioned = items.filter((i) => i.fx !== undefined && i.fy !== undefined).length;
  if (positioned === 0) {
    warnings.push('Furniture was identified but the layout could not be read from the photo — placed by heuristic.');
    return { items, mode: 'identified-only', warnings };
  }
  if (positioned < items.length) {
    warnings.push(`${items.length - positioned} item(s) had no readable position and were placed by heuristic.`);
  }
  warnings.push('Positions are estimated from one photo and scaled by the width you typed. Drag anything that looks wrong.');

  return { items, mode: 'calibrated', warnings };
}

/** Vercel / Node serverless adapter. */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  try {
    const body: AnalyzeRequest = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body?.image) {
      res.status(400).json({ error: 'image is required' });
      return;
    }
    res.status(200).json(await analyze(body));
  } catch (err) {
    res.status(200).json({
      items: [],
      mode: 'fallback',
      warnings: [`Server error: ${(err as Error).message}`],
    });
  }
}
