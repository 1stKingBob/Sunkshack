import type { FurnitureItem, Room } from '../types';
import { placeDetections, type RawDetection } from './place';

export interface PipelineOutcome {
  furniture: FurnitureItem[];
  mode: 'calibrated' | 'identified-only' | 'fallback';
  warnings: string[];
}

/** Downscale before upload: a 12 MP phone photo is slow and buys nothing here. */
export async function fileToDataUrl(file: File, maxEdge = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Photos in, placed furniture out.
 *
 * Several angles of the same room give the vision model far more to work with
 * than one: a single frame cannot show what is behind the camera or tucked
 * beside the door, and the model has to guess. The server reconciles them into
 * one plan.
 *
 * Never throws. Every failure path — no key, network down, model returns
 * nonsense — lands in the same place: an empty detection list, which the
 * caller turns into "add furniture by hand". A demo that degrades is a demo
 * that survives a hackathon wifi network.
 */
export async function analysePhotos(dataUrls: string[], room: Room): Promise<PipelineOutcome> {
  let detections: RawDetection[] = [];
  let mode: PipelineOutcome['mode'] = 'fallback';
  let warnings: string[] = [];

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ images: dataUrls, roomWidth: room.width, roomDepth: room.depth }),
    });
    if (res.ok) {
      const json = await res.json();
      detections = json.items ?? [];
      mode = json.mode ?? 'fallback';
      warnings = json.warnings ?? [];
    } else {
      warnings = [`Analysis endpoint returned ${res.status} — add furniture by hand below.`];
    }
  } catch {
    warnings = ['Could not reach the analysis endpoint — add furniture by hand below.'];
  }

  return { furniture: placeDetections(detections, room), mode, warnings };
}
