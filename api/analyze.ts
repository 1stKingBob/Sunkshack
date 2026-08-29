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
  /** data URL or bare base64. Legacy single-photo field. */
  image?: string;
  /** Several photographs of the SAME room, from different angles. */
  images?: string[];
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
- fx/fy are positions on a top-down plan, each 0 to 1. fx = 0 is the left wall, fx = 1 the right wall. fy = 0 is the far wall, fy = 1 the near wall. Give the CENTRE of each object.
- If you are given SEVERAL photographs, they are all of the SAME room from different angles. Build ONE floor plan covering the whole room. A piece of furniture visible in more than one photo is ONE object and must appear ONCE. Use the extra viewpoints to place things you could not locate confidently from a single angle, and to resolve what is behind or beside what.
- rotation is 0 if the object's long axis runs left-right in the plan, 90 if it runs near-far.
- If you cannot work out the layout, return the items with fx and fy omitted rather than guessing.

Return ONLY minified JSON, no prose, no code fence:
{"items":[{"type":"bed","confidence":0.9,"fx":0.3,"fy":0.4,"rotation":0,"sizeHint":"Queen"}]}
type must be one of: ${TYPES.join(', ')}`;

const USER_TURN = (n: number) =>
  n <= 1
    ? 'Identify the floor-standing furniture and give the top-down plan positions.'
    : `These are ${n} photographs of the SAME room from different angles. Reconcile them into ONE floor plan — each piece of furniture appears exactly once, however many photos it shows up in.`;

/** Cap the payload: more angles help, but a dozen photos is cost without gain. */
const MAX_PHOTOS = 4;

function decodePhotos(body: AnalyzeRequest): { data: string; mediaType: string }[] {
  const raw = body.images?.length ? body.images : body.image ? [body.image] : [];
  return raw.slice(0, MAX_PHOTOS).map((src) => {
    const m = /^data:(image\/[a-zA-Z+]+);/.exec(src);
    return {
      data: src.includes(',') ? src.split(',')[1] : src,
      mediaType: m ? m[1] : 'image/jpeg',
    };
  });
}

/** Anthropic Messages API with a base64 image. */
async function callAnthropic(
  key: string,
  photos: { data: string; mediaType: string }[],
): Promise<{ text?: string; error?: string }> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: 1200,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            ...photos.map((p) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: p.mediaType, data: p.data },
            })),
            { type: 'text', text: USER_TURN(photos.length) },
          ],
        },
      ],
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    return { error: `Anthropic returned ${r.status}. ${detail.slice(0, 160)}` };
  }
  const json = (await r.json()) as { content?: { type: string; text?: string }[] };
  return { text: (json.content ?? []).map((c) => c.text ?? '').join('').trim() };
}

/**
 * Google Gemini, as an alternative provider.
 *
 * Same prompt, same expected JSON shape — only the request envelope differs, so
 * whichever key is available produces an identical result downstream. Gemini is
 * worth supporting because its free tier is far easier to obtain than a billed
 * Anthropic key, which matters when the person running this is a student.
 */
async function callGemini(
  key: string,
  photos: { data: string; mediaType: string }[],
): Promise<{ text?: string; error?: string }> {
  // Google retires model aliases fairly aggressively — gemini-2.0-flash was
  // withdrawn while this was being built. If this 404s, the error body names
  // the current replacement; set GEMINI_MODEL rather than editing this line.
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [
          {
            role: 'user',
            parts: [
              ...photos.map((p) => ({ inline_data: { mime_type: p.mediaType, data: p.data } })),
              { text: USER_TURN(photos.length) },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          // Generous, because on a thinking model the reasoning is billed
          // against this same budget. At 1200 the model spent it all thinking
          // and returned truncated JSON.
          maxOutputTokens: 8192,
          temperature: 0.2,
        },
      }),
    },
  );

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    return {
      error:
        `Gemini returned ${r.status}. ${detail.slice(0, 160)}` +
        (r.status === 404 ? ` (try setting GEMINI_MODEL to a model your key can access)` : ''),
    };
  }
  const json = (await r.json()) as {
    candidates?: {
      finishReason?: string;
      content?: { parts?: { text?: string; thought?: boolean }[] };
    }[];
  };
  const cand = json.candidates?.[0];
  const parts = cand?.content?.parts ?? [];

  // Thinking models return their reasoning as additional parts flagged
  // `thought`. Concatenating everything prefixes the JSON with prose and the
  // parse fails — which is exactly how this presented: a valid response that
  // looked like a broken one.
  const answer = parts.filter((p) => !p.thought);
  const text = (answer.length ? answer : parts).map((p) => p.text ?? '').join('').trim();

  if (!text) {
    return {
      error: `Gemini returned no text (finishReason: ${cand?.finishReason ?? 'unknown'}).`,
    };
  }
  return { text };
}

export async function analyze(body: AnalyzeRequest): Promise<AnalyzeResponse> {
  const warnings: string[] = [];
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!anthropicKey && !geminiKey) {
    return {
      items: [],
      mode: 'fallback',
      warnings: [
        'No vision key configured — add ANTHROPIC_API_KEY or GEMINI_API_KEY to .env.local to enable photo analysis.',
      ],
    };
  }

  const photos = decodePhotos(body);
  if (photos.length === 0) {
    return { items: [], mode: 'fallback', warnings: ['No image was supplied.'] };
  }

  let text: string;
  try {
    // Anthropic wins if both are set; Gemini is the fallback provider.
    const res = anthropicKey
      ? await callAnthropic(anthropicKey, photos)
      : await callGemini(geminiKey!, photos);

    if (res.error) {
      return { items: [], mode: 'fallback', warnings: [res.error] };
    }
    text = res.text ?? '';
  } catch (err) {
    return {
      items: [],
      mode: 'fallback',
      warnings: [`Could not reach the vision API: ${(err as Error).message}`],
    };
  }

  // Be liberal about what comes back. Models wrap JSON in fences, prepend a
  // sentence, or append a note, despite instructions not to — so rather than
  // trusting the whole string, take the outermost braces and parse that.
  let parsed: AnalyzeResponse | null = null;
  const candidates = [
    text,
    text.replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim(),
    text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1),
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const j = JSON.parse(c);
      if (j && typeof j === 'object') {
        parsed = j;
        break;
      }
    } catch {
      /* try the next shape */
    }
  }

  if (!parsed) {
    return {
      items: [],
      mode: 'fallback',
      // Include what actually came back — "did not return usable JSON" with no
      // sample is unfixable from the outside.
      warnings: [
        `The vision model did not return usable JSON; placed by heuristic instead. It said: ${text.slice(0, 220)}`,
      ],
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
  warnings.push(
    photos.length > 1
      ? `Positions estimated from ${photos.length} photos and scaled by the width you typed. Drag anything that looks wrong.`
      : 'Positions estimated from one photo and scaled by the width you typed. More angles improve this. Drag anything that looks wrong.',
  );

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
    if (!body?.image && !body?.images?.length) {
      res.status(400).json({ error: 'image or images is required' });
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
