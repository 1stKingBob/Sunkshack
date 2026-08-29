import type { Room } from '../types';

/**
 * The default room is deliberately a *failing* one, and it fails in the exact
 * way this product exists to catch: the bed is fine where it is, the dresser is
 * fine where it is, and the 735 mm gap between them is not. Nobody spots that
 * by looking, because you are never looking at both pieces and the space
 * between them at the same time.
 */
export const DEMO_BEDROOM: Room = {
  width: 3400,
  depth: 5200,
  furniture: [
    {
      id: 'demo-bed',
      type: 'bed',
      label: 'King bed',
      // Spans x 235–2065. Leaves 1335 mm of clear floor down its east side —
      // comfortably over the 1000 mm required. Nothing wrong with it.
      x: 1150,
      y: 2300,
      width: 1830,
      depth: 2030,
      height: 600,
      rotation: 0,
      provenance: 'user',
    },
    {
      id: 'demo-wardrobe',
      type: 'wardrobe',
      // Flat against the east wall, spans x 2800–3400. Leaves 2800 mm of clear
      // floor to its west. Also nothing wrong with it.
      //
      // 2800 − 2065 = 735 mm between the two. THAT is the failure, and it
      // belongs to neither piece: it exists only in the relationship between
      // them, which is exactly the thing a person cannot see by looking at one
      // wall at a time. Drag the wardrobe to the south wall and the room clears.
      x: 3100,
      y: 2300,
      width: 1200,
      depth: 600,
      height: 2000,
      rotation: 90,
      provenance: 'user',
    },
    {
      id: 'demo-dresser',
      type: 'dresser',
      x: 460,
      y: 700,
      width: 900,
      depth: 450,
      height: 800,
      rotation: 90,
      provenance: 'user',
    },
    {
      id: 'demo-nightstand',
      type: 'nightstand',
      x: 1150,
      y: 1000,
      width: 450,
      depth: 400,
      height: 550,
      rotation: 0,
      provenance: 'user',
    },
  ],
  anchors: [
    { id: 'demo-door', kind: 'entry', label: 'Door', x: 600, y: 5100 },
    { id: 'demo-window', kind: 'destination', label: 'Window', x: 1700, y: 100 },
    { id: 'demo-bedside', kind: 'destination', label: 'Bed side', x: 2300, y: 2600 },
  ],
};

export const EMPTY_ROOM: Room = {
  width: 3400,
  depth: 5200,
  furniture: [],
  anchors: [
    { id: 'empty-door', kind: 'entry', label: 'Door', x: 600, y: 5100 },
    { id: 'empty-window', kind: 'destination', label: 'Window', x: 1700, y: 100 },
  ],
};

export function cloneRoom(room: Room): Room {
  return {
    width: room.width,
    depth: room.depth,
    furniture: room.furniture.map((f) => ({ ...f })),
    anchors: room.anchors.map((a) => ({ ...a })),
  };
}
