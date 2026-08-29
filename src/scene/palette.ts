/** Single source of truth for colour. Mirrored in styles.css as CSS variables. */
export const PALETTE = {
  paper: '#EEF1EE',
  ink: '#22303A',
  grid: '#C3CDC7',
  timber: '#B08B67',
  crimson: '#C4432E',
  emerald: '#2D6A4F',
} as const;

export const PALETTE_HEX = {
  paper: 0xeef1ee,
  ink: 0x22303a,
  grid: 0xc3cdc7,
  timber: 0xb08b67,
  crimson: 0xc4432e,
  emerald: 0x2d6a4f,
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
