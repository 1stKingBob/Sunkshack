import { useEffect, useRef, useState } from 'react';
import type { ClearanceResult, Room } from '../types';
import { RoomScene, type SceneLabel, type SceneMode } from '../scene/RoomScene';

interface Props {
  room: Room;
  result: ClearanceResult | null;
  selectedId: string | null;
  mode: SceneMode;
  showWheelchair: boolean;
  onSelect(id: string | null): void;
  onMove(id: string, x: number, y: number): void;
  onPlacePoint(x: number, y: number): void;
}

export function Stage(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<RoomScene | null>(null);
  const [labels, setLabels] = useState<SceneLabel[]>([]);

  // Callbacks are held in a ref so the scene is built exactly once — rebuilding
  // a WebGL context on every React render would be a disaster.
  const cbs = useRef(props);
  cbs.current = props;

  useEffect(() => {
    if (!host.current) return;
    const s = new RoomScene(host.current, {
      onSelect: (id) => cbs.current.onSelect(id),
      onMove: (id, x, y) => cbs.current.onMove(id, x, y),
      onPlacePoint: (x, y) => cbs.current.onPlacePoint(x, y),
      onLabels: setLabels,
    });
    scene.current = s;
    s.setRoom(cbs.current.room);
    s.frameRoom();
    return () => {
      s.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => { scene.current?.setRoom(props.room); }, [props.room]);
  useEffect(() => { scene.current?.setResult(props.result); }, [props.result]);
  useEffect(() => { scene.current?.setSelected(props.selectedId); }, [props.selectedId]);
  useEffect(() => { scene.current?.setMode(props.mode); }, [props.mode]);
  useEffect(() => { scene.current?.setShowWheelchair(props.showWheelchair); }, [props.showWheelchair]);

  return (
    <>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      <div className="labels">
        {labels.map((l) => (
          <div key={l.id} className="label" data-tone={l.tone} style={{ left: l.x, top: l.y }}>
            {l.text}
            {l.sub && <span className="sub">{l.sub}</span>}
          </div>
        ))}
      </div>
    </>
  );
}

export function reframe(_: unknown) {}
