import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ClearanceResult, Room } from '../types';
import { footprint } from '../engine/grid';
import { makeHatchCanvas, PALETTE, PALETTE_HEX } from './palette';
import { buildWheelchair } from './wheelchair';

export type SceneMode = 'select' | 'place-entry' | 'place-destination';

export interface SceneLabel {
  id: string;
  text: string;
  sub?: string;
  tone: 'ink' | 'crimson' | 'emerald';
  /** screen px */
  x: number;
  y: number;
}

export interface SceneCallbacks {
  onSelect(id: string | null): void;
  onMove(id: string, x: number, y: number): void;
  onPlacePoint(x: number, y: number): void;
  onLabels(labels: SceneLabel[]): void;
}

const MM = 0.001; // scene units are metres

export class RoomScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private roomGroup = new THREE.Group();
  private furnitureGroup = new THREE.Group();
  private anchorGroup = new THREE.Group();
  private analysisGroup = new THREE.Group();
  private chair: THREE.Group;

  private room: Room | null = null;
  private result: ClearanceResult | null = null;
  private selectedId: string | null = null;
  private mode: SceneMode = 'select';
  private showChair = true;

  private dragging: { id: string; grabDx: number; grabDy: number } | null = null;
  private pickables: THREE.Object3D[] = [];
  private labelSources: { id: string; text: string; sub?: string; tone: SceneLabel['tone']; pos: THREE.Vector3 }[] = [];

  private framedOnce = false;
  private raf = 0;
  private clock = new THREE.Clock();
  private disposed = false;

  constructor(
    private container: HTMLElement,
    private cb: SceneCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(PALETTE.paper);
    this.scene.fog = new THREE.Fog(PALETTE.paper, 14, 30);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 6.4, 6.2);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 18;
    this.controls.target.set(0, 0, 0);

    // Flat, even light — this is a drawing, not a photograph. Strong shadows
    // would compete with the hatching that carries the pass/fail signal.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xa8b2ad, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(4, 9, 5);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-5, 4, -3);
    this.scene.add(fill);

    this.scene.add(this.roomGroup, this.furnitureGroup, this.anchorGroup, this.analysisGroup);

    this.chair = buildWheelchair();
    this.chair.visible = false;
    this.scene.add(this.chair);

    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.resize);

    this.resize();
    this.tick();
  }

  // ── public API ──────────────────────────────────────────────────────────

  setMode(mode: SceneMode) {
    this.mode = mode;
    this.renderer.domElement.style.cursor = mode === 'select' ? 'grab' : 'crosshair';
  }

  setSelected(id: string | null) {
    this.selectedId = id;
    this.refreshFurniture();
  }

  setShowWheelchair(v: boolean) {
    this.showChair = v;
  }

  setRoom(room: Room) {
    const changedShell = !this.room || this.room.width !== room.width || this.room.depth !== room.depth;
    this.room = room;
    if (changedShell) {
      this.buildShell();
      // A resized room needs refitting, or half of it ends up off screen.
      this.frameRoom();
    }
    this.refreshFurniture();
    this.refreshAnchors();
  }

  setResult(result: ClearanceResult | null) {
    this.result = result;
    this.refreshAnalysis();
  }

  /**
   * Fit the whole room in view.
   *
   * Rooms are not square — a 3.4 × 5.2 m bedroom is far deeper than it is wide —
   * so a fixed camera distance either crops a long room or leaves a wide one
   * swimming in empty paper. Fitting the bounding sphere against both the
   * vertical and horizontal field of view handles every aspect ratio, including
   * a narrow phone viewport.
   */
  frameRoom() {
    if (!this.room) return;
    const w = this.room.width * MM;
    const d = this.room.depth * MM;
    const radius = 0.5 * Math.hypot(w, d);

    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.06;

    // Steep enough to read as a floor plan — at a low angle the furniture
    // occludes the very floor space the whole tool is about.
    const elev = (57 * Math.PI) / 180;
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, dist * Math.sin(elev), dist * Math.cos(elev));
    this.controls.maxDistance = dist * 2.2;
    this.controls.update();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.resize);
    this.controls.dispose();
    this.renderer.dispose();
    if (el.parentElement) el.parentElement.removeChild(el);
  }

  // ── coordinate helpers ──────────────────────────────────────────────────

  private toWorld(x: number, y: number) {
    const r = this.room!;
    return new THREE.Vector3((x - r.width / 2) * MM, 0, (y - r.depth / 2) * MM);
  }

  private toRoom(v: THREE.Vector3) {
    const r = this.room!;
    return { x: v.x / MM + r.width / 2, y: v.z / MM + r.depth / 2 };
  }

  // ── construction ────────────────────────────────────────────────────────

  private buildShell() {
    const r = this.room!;
    this.roomGroup.clear();
    const w = r.width * MM;
    const d = r.depth * MM;

    // Floor with a drafting grid baked into a texture — crisper and far
    // cheaper than thousands of line segments.
    const cell = 100; // mm — visual grid stays at 100 mm regardless of compute resolution
    const cols = Math.ceil(r.width / cell);
    const rows = Math.ceil(r.depth / cell);
    const px = Math.min(10, Math.floor(2048 / Math.max(cols, rows)));
    const cv = document.createElement('canvas');
    cv.width = cols * px;
    cv.height = rows * px;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = PALETTE.grid;
    for (let i = 0; i <= cols; i++) {
      ctx.lineWidth = i % 10 === 0 ? 1.6 : 0.6;
      ctx.globalAlpha = i % 10 === 0 ? 0.95 : 0.55;
      ctx.beginPath();
      ctx.moveTo(i * px, 0);
      ctx.lineTo(i * px, cv.height);
      ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      ctx.lineWidth = j % 10 === 0 ? 1.6 : 0.6;
      ctx.globalAlpha = j % 10 === 0 ? 0.95 : 0.55;
      ctx.beginPath();
      ctx.moveTo(0, j * px);
      ctx.lineTo(cv.width, j * px);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.roomGroup.add(floor);

    // Room outline — the heaviest line in the drawing, as on a floor plan.
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.001, d)),
      new THREE.LineBasicMaterial({ color: PALETTE_HEX.ink }),
    );
    this.roomGroup.add(outline);

    // Low walls give the plan just enough depth to read as a room in 3D.
    const wallH = 0.35;
    const wallT = 0.03;
    const wallMat = new THREE.MeshLambertMaterial({
      color: PALETTE_HEX.ink,
      transparent: true,
      opacity: 0.14,
    });
    const walls: [number, number, number, number][] = [
      [w + wallT, wallT, 0, -d / 2],
      [w + wallT, wallT, 0, d / 2],
      [wallT, d + wallT, -w / 2, 0],
      [wallT, d + wallT, w / 2, 0],
    ];
    for (const [bw, bd, x, z] of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, wallH, bd), wallMat);
      m.position.set(x, wallH / 2, z);
      this.roomGroup.add(m);
    }
  }

  private refreshFurniture() {
    if (!this.room) return;
    this.furnitureGroup.clear();
    this.pickables = [];

    for (const item of this.room.furniture) {
      const f = footprint(item);
      const g = new THREE.Group();
      const h = Math.max(item.height, 120) * MM;

      const isSel = item.id === this.selectedId;
      // Tall items are drawn translucent — a 2 m wardrobe at full opacity hides
      // the floor space this tool exists to show. An estimated placement is
      // lighter again, so the drawing never implies more certainty than the
      // data behind it has.
      const tallFade = item.height > 1100 ? 0.55 : 0.92;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(f.w * MM, h, f.d * MM),
        new THREE.MeshLambertMaterial({
          color: PALETTE_HEX.timber,
          transparent: true,
          opacity: item.provenance === 'estimated' ? tallFade * 0.8 : tallFade,
          depthWrite: false,
        }),
      );
      body.position.y = h / 2;
      g.add(body);

      // Warm Timber sits at only 2.74:1 against the paper background — below
      // the 3:1 needed for a shape to be reliably distinguishable. This outline
      // is what actually makes the block visible, not decoration.
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(f.w * MM, h, f.d * MM)),
        new THREE.LineBasicMaterial({ color: isSel ? PALETTE_HEX.emerald : PALETTE_HEX.ink }),
      );
      edges.position.y = h / 2;
      g.add(edges);

      if (isSel) {
        const halo = new THREE.Mesh(
          new THREE.RingGeometry(
            Math.max(f.w, f.d) * MM * 0.62,
            Math.max(f.w, f.d) * MM * 0.68,
            48,
          ),
          new THREE.MeshBasicMaterial({
            color: PALETTE_HEX.emerald,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
          }),
        );
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = 0.004;
        g.add(halo);
      }

      const p = this.toWorld(item.x, item.y);
      g.position.copy(p);
      g.userData.itemId = item.id;
      body.userData.itemId = item.id;
      this.furnitureGroup.add(g);
      this.pickables.push(body);
    }
  }

  private refreshAnchors() {
    if (!this.room) return;
    this.anchorGroup.clear();
    for (const a of this.room.anchors) {
      const isEntry = a.kind === 'entry';
      const col = isEntry ? PALETTE_HEX.ink : PALETTE_HEX.emerald;
      const g = new THREE.Group();

      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.13, 28),
        new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.006;
      g.add(disc);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.17, 0.2, 28),
        new THREE.MeshBasicMaterial({
          color: col,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.005;
      g.add(ring);

      // A pin: entry gets a square head, destinations a round one, so the two
      // kinds are distinguishable without relying on their colours.
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.46, 8),
        new THREE.MeshBasicMaterial({ color: col }),
      );
      stem.position.y = 0.23;
      g.add(stem);
      const head = isEntry
        ? new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: col }))
        : new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshLambertMaterial({ color: col }));
      head.position.y = 0.5;
      g.add(head);

      g.position.copy(this.toWorld(a.x, a.y));
      this.anchorGroup.add(g);
    }
  }

  private refreshAnalysis() {
    if (!this.room) return;
    this.analysisGroup.clear();
    this.labelSources = [];
    const res = this.result;
    if (!res) return;

    const hatchTex = new THREE.CanvasTexture(makeHatchCanvas(PALETTE.crimson));
    hatchTex.wrapS = hatchTex.wrapT = THREE.RepeatWrapping;
    hatchTex.repeat.set(3, 3);

    // ── routes ────────────────────────────────────────────────────────────
    // Routes to different destinations share most of their length. Drawn at the
    // same height they z-fight into a barber's pole, so failing routes are
    // lifted above passing ones and drawn heavier: the problem should be the
    // thing that reads first.
    for (const route of res.routes) {
      if (route.points.length < 2) continue;
      const y = route.passes ? 0.010 : 0.017;
      const pts = route.points.map((p) => {
        const v = this.toWorld(p.x, p.y);
        v.y = y;
        return v;
      });
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.35);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(24, pts.length * 6), route.passes ? 0.019 : 0.03, 8, false),
        new THREE.MeshBasicMaterial({
          color: route.passes ? PALETTE_HEX.emerald : PALETTE_HEX.crimson,
          transparent: true,
          opacity: route.passes ? 0.6 : 1,
        }),
      );
      this.analysisGroup.add(tube);
    }

    // ── bottleneck callouts ───────────────────────────────────────────────
    for (const route of res.routes) {
      if (route.passes || route.points.length < 2) continue;
      const c = this.toWorld(route.bottleneckAt.x, route.bottleneckAt.y);

      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(Math.max(route.bottleneck, 300) * MM * 0.85, 40),
        new THREE.MeshBasicMaterial({
          map: hatchTex,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide,
        }),
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(c.x, 0.009, c.z);
      this.analysisGroup.add(patch);

      const outline = new THREE.Mesh(
        new THREE.RingGeometry(
          Math.max(route.bottleneck, 300) * MM * 0.85,
          Math.max(route.bottleneck, 300) * MM * 0.85 + 0.018,
          48,
        ),
        new THREE.MeshBasicMaterial({ color: PALETTE_HEX.crimson, side: THREE.DoubleSide }),
      );
      outline.rotation.x = -Math.PI / 2;
      outline.position.set(c.x, 0.011, c.z);
      this.analysisGroup.add(outline);

      this.labelSources.push({
        id: `neck-${route.toAnchorId}`,
        text: `${Math.round(route.bottleneck)}`,
        sub: `needs ${Math.round(res.violations.find((v) => v.betweenAnchors?.[1] === route.toAnchorId)?.required ?? 0)}`,
        tone: 'crimson',
        pos: new THREE.Vector3(c.x, 0.5, c.z),
      });
    }

    // ── turning circle ────────────────────────────────────────────────────
    const tc = res.turningCircle;
    if (tc) {
      const c = this.toWorld(tc.centre.x, tc.centre.y);
      const r = (tc.diameter / 2) * MM;
      const col = tc.passes ? PALETTE_HEX.emerald : PALETTE_HEX.crimson;

      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(r, 64),
        tc.passes
          ? new THREE.MeshBasicMaterial({
              color: col,
              transparent: true,
              opacity: 0.16,
              side: THREE.DoubleSide,
            })
          : new THREE.MeshBasicMaterial({
              map: hatchTex,
              transparent: true,
              opacity: 0.75,
              side: THREE.DoubleSide,
            }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(c.x, 0.007, c.z);
      this.analysisGroup.add(disc);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.012, r, 64),
        new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(c.x, 0.013, c.z);
      this.analysisGroup.add(ring);

      this.labelSources.push({
        id: 'turn',
        text: `⌀ ${Math.round(tc.diameter)}`,
        sub: tc.passes ? 'turning space' : 'too tight to turn',
        tone: tc.passes ? 'emerald' : 'crimson',
        pos: new THREE.Vector3(c.x, 0.36, c.z),
      });
    }

    // anchor name labels
    for (const a of this.room.anchors) {
      const p = this.toWorld(a.x, a.y);
      this.labelSources.push({
        id: `anchor-${a.id}`,
        text: a.label,
        tone: 'ink',
        pos: new THREE.Vector3(p.x, 0.62, p.z),
      });
    }
  }

  // ── interaction ─────────────────────────────────────────────────────────

  private setPointer(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private groundPoint(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, hit) ? hit : null;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || !this.room) return;
    this.setPointer(e);

    if (this.mode !== 'select') {
      const p = this.groundPoint();
      if (p) {
        const { x, y } = this.toRoom(p);
        const r = this.room;
        this.cb.onPlacePoint(
          Math.min(r.width, Math.max(0, x)),
          Math.min(r.depth, Math.max(0, y)),
        );
      }
      return;
    }

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    if (hits.length === 0) {
      this.cb.onSelect(null);
      return;
    }

    const id = hits[0].object.userData.itemId as string;
    const item = this.room.furniture.find((f) => f.id === id);
    const p = this.groundPoint();
    if (!item || !p) return;
    const at = this.toRoom(p);
    this.dragging = { id, grabDx: item.x - at.x, grabDy: item.y - at.y };
    this.controls.enabled = false;
    this.renderer.domElement.style.cursor = 'grabbing';
    this.cb.onSelect(id);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging || !this.room) return;
    this.setPointer(e);
    const p = this.groundPoint();
    if (!p) return;
    const at = this.toRoom(p);
    const item = this.room.furniture.find((f) => f.id === this.dragging!.id);
    if (!item) return;
    const f = footprint(item);
    // keep the whole footprint inside the room
    const x = Math.min(
      this.room.width - f.w / 2,
      Math.max(f.w / 2, at.x + this.dragging.grabDx),
    );
    const y = Math.min(
      this.room.depth - f.d / 2,
      Math.max(f.d / 2, at.y + this.dragging.grabDy),
    );
    this.cb.onMove(this.dragging.id, Math.round(x), Math.round(y));
  };

  private onPointerUp = () => {
    if (this.dragging) {
      this.dragging = null;
      this.controls.enabled = true;
      this.renderer.domElement.style.cursor = this.mode === 'select' ? 'grab' : 'crosshair';
    }
  };

  private resize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    const hadAspect = this.camera.aspect;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // First real layout: the constructor ran before the container had a size,
    // so the initial fit used a meaningless aspect ratio.
    if (!this.framedOnce && this.room) {
      this.framedOnce = true;
      this.frameRoom();
    } else if (Math.abs(hadAspect - this.camera.aspect) > 0.35 && this.room) {
      this.frameRoom();
    }
  };

  // ── loop ────────────────────────────────────────────────────────────────

  private tick = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const t = this.clock.getElapsedTime();

    this.controls.update();
    this.animateChair(t);
    this.renderer.render(this.scene, this.camera);
    this.emitLabels();
  };

  /**
   * The wheelchair drives the first route and stops dead at the bottleneck when
   * it does not fit. That stop is the whole demo: it is one thing to read
   * "735 mm", and another to watch the chair physically fail to get through.
   */
  private animateChair(t: number) {
    const route = this.result?.routes.find((r) => r.points.length >= 2);
    if (!this.showChair || !route || !this.room) {
      this.chair.visible = false;
      return;
    }
    this.chair.visible = true;

    const pts = route.points.map((p) => {
      const v = this.toWorld(p.x, p.y);
      v.y = 0;
      return v;
    });
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.4);

    let u: number;
    if (route.passes) {
      u = (t * 0.13) % 1;
    } else {
      // find how far along the route the bottleneck sits
      const neck = this.toWorld(route.bottleneckAt.x, route.bottleneckAt.y);
      let stopU = 0.5;
      let bestD = Infinity;
      for (let i = 0; i <= 100; i++) {
        const s = i / 100;
        const p = curve.getPoint(s);
        const d = (p.x - neck.x) ** 2 + (p.z - neck.z) ** 2;
        if (d < bestD) {
          bestD = d;
          stopU = s;
        }
      }
      // roll up, hesitate at the pinch, back off, try again
      const cycle = (t * 0.34) % 3;
      const approach = Math.min(1, cycle / 1.5);
      const eased = approach < 1 ? approach : 1;
      const nudge = cycle > 1.5 && cycle < 2.2 ? Math.sin((cycle - 1.5) * 9) * 0.012 : 0;
      u = Math.max(0, stopU * eased * 0.97 + nudge);
    }

    const pos = curve.getPoint(u);
    const ahead = curve.getPoint(Math.min(0.999, u + 0.01));
    this.chair.position.set(pos.x, 0, pos.z);
    const dir = new THREE.Vector3().subVectors(ahead, pos);
    if (dir.lengthSq() > 1e-8) this.chair.rotation.y = Math.atan2(dir.x, dir.z);
  }

  private emitLabels() {
    if (this.labelSources.length === 0) {
      this.cb.onLabels([]);
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    const out: SceneLabel[] = [];
    const v = new THREE.Vector3();
    for (const src of this.labelSources) {
      v.copy(src.pos).project(this.camera);
      if (v.z > 1) continue;
      out.push({
        id: src.id,
        text: src.text,
        sub: src.sub,
        tone: src.tone,
        x: ((v.x + 1) / 2) * rect.width,
        y: ((-v.y + 1) / 2) * rect.height,
      });
    }
    this.cb.onLabels(out);
  }
}
