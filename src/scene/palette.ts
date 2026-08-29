/**
 * Single source of truth for colour. Mirrored in styles.css as CSS variables.
 *
 * The two blues are the wheelchair, and they are blue for a reason beyond
 * taste. Rendered in the same ink-and-timber as the furniture, the chair reads
 * as one more object on the floor rather than as the person moving through the
 * room. Blue also happens to be the one axis that survives red–green colour
 * blindness, so the chair stays clearly separate from both the emerald pass
 * state and the crimson failure state for every viewer.
 *
 * Steel is 6.19:1 against the paper, sky 4.69:1 — both well clear of the 3:1
 * a shape needs to be distinguishable.
 */
export const PALETTE = {
  paper: '#EEF1EE',
  ink: '#22303A',
  grid: '#C3CDC7',
  timber: '#B08B67',
  crimson: '#C4432E',
  emerald: '#2D6A4F',
  steel: '#1D5C8F',
  sky: '#2A6FA8',
  night: '#141C22',
} as const;

export const PALETTE_HEX = {
  paper: 0xeef1ee,
  ink: 0x22303a,
  grid: 0xc3cdc7,
  timber: 0xb08b67,
  crimson: 0xc4432e,
  emerald: 0x2d6a4f,
  steel: 0x1d5c8f,
  sky: 0x2a6fa8,
} as const;

/**
 * Diagonal hatching, drawn to a canvas and used as a texture.
 *
 * This is not decoration. Signal Crimson and Forest Emerald sit at a contrast
 * ratio of 1.27:1 against each other — they differ almost purely in hue, which
 * is the one axis a red–green colourblind viewer cannot use. Encoding pass and
 * fail in colour alone would make an accessibility tool inaccessible. Hatched
 * fill for failures and solid fill for passes survives greyscale, survives
 * colourblindness, and happens to be exactly how a real architectural drawing
 * marks a problem area.
 */
export function makeHatchCanvas(color: string, size = 64, gap = 10): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'square';
  for (let i = -size; i < size * 2; i += gap) {
    ctx.beginPath();
    ctx.moveTo(i, -1);
    ctx.lineTo(i + size, size + 1);
    ctx.stroke();
  }
  return c;
}
