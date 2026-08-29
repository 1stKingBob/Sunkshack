import * as THREE from 'three';
import { PALETTE_HEX } from './palette';

/**
 * A wheelchair built from primitives rather than loaded as an asset — it keeps
 * the app dependency-free and offline-safe, and at this scale a recognisable
 * silhouette is all the demo needs. Modelled facing +Z, sized roughly to a real
 * manual chair (about 650 mm wide, 1100 mm long).
 * Scene units are metres.
 */
export function buildWheelchair(): THREE.Group {
  const g = new THREE.Group();

  // Blue, not ink-and-timber: the chair is the person moving through the room,
  // not another object sitting in it, and it needs to read that way at a glance.
  const frame = new THREE.MeshLambertMaterial({ color: PALETTE_HEX.steel });
  const seatMat = new THREE.MeshLambertMaterial({ color: PALETTE_HEX.sky });
  const tyre = new THREE.MeshLambertMaterial({ color: 0x1a2530 });

  // seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.44), seatMat);
  seat.position.set(0, 0.5, 0);
  g.add(seat);

  // backrest
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.06), seatMat);
  back.position.set(0, 0.74, -0.22);
  g.add(back);

  // push handles
  for (const dx of [-0.2, 0.2]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8), frame);
    h.position.set(dx, 1.04, -0.24);
    g.add(h);
  }

  // main wheels
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20);
  for (const dx of [-0.33, 0.33]) {
    const w = new THREE.Mesh(wheelGeo, tyre);
    w.rotation.z = Math.PI / 2;
    w.position.set(dx, 0.3, -0.05);
    g.add(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10), frame);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(dx, 0.3, -0.05);
    g.add(hub);
  }

  // front castors
  const castGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.035, 12);
  for (const dx of [-0.22, 0.22]) {
    const c = new THREE.Mesh(castGeo, tyre);
    c.rotation.z = Math.PI / 2;
    c.position.set(dx, 0.09, 0.4);
    g.add(c);
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), frame);
    fork.position.set(dx, 0.26, 0.4);
    g.add(fork);
  }

  // footplate
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.16), frame);
  foot.position.set(0, 0.14, 0.42);
  g.add(foot);

  // armrests
  for (const dx of [-0.26, 0.26]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.42), frame);
    a.position.set(dx, 0.72, 0.02);
    g.add(a);
  }

  return g;
}
