"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

export type ShoeStyle = "formal" | "loafer" | "sneaker";

export interface Outfit {
  topColor: string;
  topKind: "shirt" | "sweat" | "tee";
  sleeve: "long" | "short";
  jacketColor: string | null;
  vestColor: string | null;
  tieColor: string | null;
  bottomColor: string;
  jeans: boolean;
  shoeColor: string;
  soleColor: string;
  shoeStyle: ShoeStyle;
  beltColor: string;
  watchColor: string;
}

export interface MannequinProps {
  outfit: Outfit;
  view: { azimuth: number; key: number };
  autoRotate: boolean;
}

const SKIN = "#8A5A3C";
const HAIR = "#1C1512";
const METAL = "#C3C6CB";
const Z_SCALE = 0.62;
const DIST = 4.6;
const PHI = Math.PI / 2 - 0.035;
const TARGET: [number, number, number] = [0, 0.9, 0];
const HIP_Y = 0.92;
const VEST_OFF = 0.03;
const TAU = Math.PI * 2;

// Torso silhouette as [height, radius], crotch to neck. Depth is the same profile squashed by Z_SCALE.
const TORSO: [number, number][] = [
  [0.84, 0.0], [0.85, 0.12], [0.88, 0.172], [0.92, 0.184], [0.97, 0.176], [1.03, 0.158],
  [1.09, 0.15], [1.16, 0.158], [1.24, 0.176], [1.32, 0.192], [1.39, 0.198], [1.44, 0.186],
  [1.475, 0.15], [1.495, 0.09], [1.505, 0.055],
];
const PROFILE = new THREE.SplineCurve(TORSO.map(([y, r]) => new THREE.Vector2(r, y)))
  .getSpacedPoints(300)
  .map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));

function torsoR(y: number) {
  if (y <= PROFILE[0].y) return PROFILE[0].x;
  for (let i = 1; i < PROFILE.length; i++) {
    const b = PROFILE[i];
    if (y <= b.y) {
      const a = PROFILE[i - 1];
      return a.x + ((y - a.y) / (b.y - a.y || 1)) * (b.x - a.x);
    }
  }
  return PROFILE[PROFILE.length - 1].x;
}

// A garment shell that follows the torso at a fixed offset between two heights.
function band(y0: number, y1: number, offset: number, closeBottom = false, hipFloor = false) {
  const pts: THREE.Vector2[] = [];
  if (closeBottom) pts.push(new THREE.Vector2(0, y0));
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps;
    let r = torsoR(y);
    if (hipFloor && y < HIP_Y) r = Math.max(r, torsoR(HIP_Y));
    pts.push(new THREE.Vector2(r + offset, y));
  }
  return pts;
}

// Point on the front surface of the squashed torso at height y.
function frontZ(y: number, offset: number) {
  return (torsoR(y) + offset) * Z_SCALE;
}

// Torso shell whose front opening widens with height, giving a V neckline (waistcoat).
function vNeckShell(y0: number, y1: number, offset: number, vFrom: number, vMax: number) {
  const rows = 40;
  const cols = 72;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const y = y0 + ((y1 - y0) * i) / rows;
    const r = torsoR(y) + offset;
    const gap = 0.02 + (y > vFrom ? ((y - vFrom) / (y1 - vFrom)) * vMax : 0);
    for (let j = 0; j <= cols; j++) {
      const phi = gap + ((TAU - 2 * gap) * j) / cols;
      pos.push(r * Math.sin(phi), y, r * Math.cos(phi));
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;
      const b = a + cols + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Tie blade lying on the shirt front, widening from the knot to a point.
function tieBlade(offset: number) {
  const top = 1.465;
  const bottom = 1.0;
  const steps = 30;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = top - (top - bottom) * t;
    const w = 0.012 + 0.026 * t;
    const z = frontZ(y, offset);
    pos.push(-w, y, z, w, y, z);
  }
  const tipY = bottom - 0.035;
  pos.push(0, tipY, frontZ(tipY, offset));
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const last = steps * 2;
  idx.push(last, last + 2, last + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function shade(hex: string, amount: number) {
  return "#" + new THREE.Color(hex).multiplyScalar(amount).getHexString();
}

interface MatProps {
  color: string;
  roughness?: number;
  sheen?: number;
  metalness?: number;
  clearcoat?: number;
}

// Physical material that eases to a new color instead of snapping.
function Mat({ color, roughness = 0.82, sheen = 0.35, metalness = 0, clearcoat = 0 }: MatProps) {
  const ref = useRef<THREE.MeshPhysicalMaterial>(null);
  const [initial] = useState(color);
  const target = useMemo(() => new THREE.Color(color), [color]);
  useFrame((_, dt) => {
    ref.current?.color.lerp(target, 1 - Math.exp(-dt * 9));
  });
  return (
    <meshPhysicalMaterial
      ref={ref}
      color={initial}
      roughness={roughness}
      metalness={metalness}
      sheen={sheen}
      sheenRoughness={0.8}
      sheenColor="#ffffff"
      clearcoat={clearcoat}
      clearcoatRoughness={0.4}
      side={THREE.DoubleSide}
    />
  );
}

const Skin = () => <Mat color={SKIN} roughness={0.52} sheen={0.12} />;

function Tube({ r1, r2, h, y, color, roughness }: { r1: number; r2: number; h: number; y: number; color: string; roughness?: number }) {
  return (
    <mesh position={[0, y, 0]}>
      <cylinderGeometry args={[r1, r2, h, 40, 1, true]} />
      <Mat color={color} roughness={roughness} />
    </mesh>
  );
}

function Head() {
  return (
    <group>
      <mesh position={[0, 1.555, 0]}>
        <cylinderGeometry args={[0.046, 0.052, 0.17, 32]} />
        <Skin />
      </mesh>
      <group position={[0, 1.7, 0]} scale={[0.88, 1.12, 1]}>
        <mesh>
          <sphereGeometry args={[0.1, 48, 32]} />
          <Skin />
        </mesh>
        <mesh rotation={[-0.42, 0, 0]} scale={1.045}>
          <sphereGeometry args={[0.1, 48, 24, 0, TAU, 0, 1.42]} />
          <Mat color={HAIR} roughness={0.9} sheen={0.5} />
        </mesh>
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.087, 1.69, -0.006]} scale={[0.45, 1, 0.75]}>
          <sphereGeometry args={[0.022, 16, 12]} />
          <Skin />
        </mesh>
      ))}
      <mesh position={[0, 1.688, 0.097]} scale={[0.7, 1.15, 1]}>
        <sphereGeometry args={[0.017, 16, 12]} />
        <Skin />
      </mesh>
    </group>
  );
}

function Torso({ o }: { o: Outfit }) {
  const tucked = o.topKind === "shirt";
  const shirtOff = tucked ? 0.008 : 0.02;
  const pantsOff = tucked ? 0.016 : 0.008;
  const beltOff = pantsOff + 0.006;

  const body = useMemo(() => PROFILE, []);
  const shirt = useMemo(
    () => [...band(tucked ? 0.95 : 0.87, 1.495, shirtOff), new THREE.Vector2(0.065, 1.51)],
    [tucked, shirtOff],
  );
  const pants = useMemo(() => band(0.84, tucked ? 1.0 : 0.985, pantsOff, true), [tucked, pantsOff]);
  const belt = useMemo(() => band(0.955, 0.99, beltOff), [beltOff]);
  const rib = useMemo(() => band(0.87, 0.905, shirtOff + 0.005), [shirtOff]);
  const jacket = useMemo(() => [...band(0.8, 1.49, 0.042, false, true), new THREE.Vector2(0.09, 1.515)], []);
  const vest = useMemo(() => vNeckShell(0.93, 1.45, VEST_OFF, 1.16, 0.95), []);
  const tie = useMemo(() => tieBlade(shirtOff + 0.005), [shirtOff]);
  const showTie = tucked && o.tieColor;

  return (
    <group>
      <group scale={[1, 1, Z_SCALE]}>
        <mesh>
          <latheGeometry args={[body, 64]} />
          <Skin />
        </mesh>
        <mesh>
          <latheGeometry args={[shirt, 72]} />
          <Mat color={o.topColor} roughness={o.topKind === "shirt" ? 0.7 : 0.88} sheen={o.topKind === "sweat" ? 0.6 : 0.35} />
        </mesh>
        <mesh>
          <latheGeometry args={[pants, 72]} />
          <Mat color={o.bottomColor} roughness={o.jeans ? 0.95 : 0.78} />
        </mesh>
        {tucked && (
          <mesh>
            <latheGeometry args={[belt, 72]} />
            <Mat color={o.beltColor} roughness={0.38} sheen={0} clearcoat={0.4} />
          </mesh>
        )}
        {o.topKind === "sweat" && (
          <mesh>
            <latheGeometry args={[rib, 72]} />
            <Mat color={shade(o.topColor, 0.9)} roughness={0.95} />
          </mesh>
        )}
        {o.vestColor && (
          <mesh geometry={vest}>
            <Mat color={o.vestColor} roughness={0.68} sheen={0.4} />
          </mesh>
        )}
        {o.jacketColor && (
          <mesh>
            <latheGeometry args={[jacket, 72, 0.3, TAU - 0.6]} />
            <Mat color={o.jacketColor} roughness={0.75} sheen={0.45} />
          </mesh>
        )}
      </group>

      {showTie && (
        <>
          <mesh geometry={tie}>
            <Mat color={o.tieColor!} roughness={0.42} sheen={0.25} />
          </mesh>
          <RoundedBox args={[0.034, 0.03, 0.02]} radius={0.008} smoothness={3} position={[0, 1.483, frontZ(1.483, shirtOff) + 0.012]}>
            <Mat color={o.tieColor!} roughness={0.42} sheen={0.25} />
          </RoundedBox>
        </>
      )}

      {o.vestColor && (
        <>
          {[0.97, 1.03, 1.09, 1.15].map((y) => (
            <mesh key={y} position={[0, y, frontZ(y, VEST_OFF) + 0.003]} scale={[1, 1, 0.5]}>
              <sphereGeometry args={[0.008, 12, 8]} />
              <Mat color="#4B4B50" roughness={0.3} sheen={0} />
            </mesh>
          ))}
          {[-1, 1].map((s) => {
            const r = torsoR(1.02) + VEST_OFF;
            const x = 0.1;
            const z = r * Z_SCALE * Math.sqrt(1 - (x / r) ** 2) + 0.002;
            return (
              <mesh key={s} position={[s * x, 1.02, z]} rotation={[0, s * 0.55, 0]}>
                <boxGeometry args={[0.06, 0.008, 0.004]} />
                <Mat color={shade(o.vestColor!, 0.7)} roughness={0.7} sheen={0} />
              </mesh>
            );
          })}
        </>
      )}

      {tucked && !o.vestColor && (
        <group position={[0, 0.972, frontZ(0.972, beltOff) + 0.004]}>
          <RoundedBox args={[0.05, 0.042, 0.01]} radius={0.004} smoothness={3}>
            <Mat color={METAL} roughness={0.25} metalness={0.9} sheen={0} />
          </RoundedBox>
          <RoundedBox args={[0.034, 0.026, 0.014]} radius={0.003} smoothness={3}>
            <Mat color={o.beltColor} roughness={0.4} sheen={0} />
          </RoundedBox>
        </group>
      )}

      {tucked && (
        <>
          <mesh position={[0, 1.515, 0]}>
            <cylinderGeometry args={[0.06, 0.07, 0.045, 40, 1, true]} />
            <Mat color={o.topColor} roughness={0.7} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.026, 1.49, 0.052]} rotation={[0.35, 0, s * 0.65]}>
              <boxGeometry args={[0.05, 0.03, 0.006]} />
              <Mat color={o.topColor} roughness={0.7} />
            </mesh>
          ))}
          {[1.02, 1.1, 1.18, 1.26, 1.34, 1.42].map((y) => (
            <mesh key={y} position={[0, y, frontZ(y, shirtOff) + 0.002]} scale={[1, 1, 0.5]}>
              <sphereGeometry args={[0.0065, 12, 8]} />
              <Mat color="#ECE9E3" roughness={0.3} sheen={0} />
            </mesh>
          ))}
        </>
      )}

      {!tucked && (
        <group position={[0, 1.497, 0]} scale={[1, 1, 0.8]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.066, 0.011, 16, 48]} />
            <Mat color={shade(o.topColor, 0.92)} roughness={0.9} />
          </mesh>
        </group>
      )}

      {o.jacketColor && (
        <>
          <mesh position={[Math.sin(0.3) * 0.21, 1.02, frontZ(1.02, 0.046) * Math.cos(0.3)]}>
            <sphereGeometry args={[0.011, 16, 12]} />
            <Mat color={shade(o.jacketColor, 0.55)} roughness={0.35} sheen={0} />
          </mesh>
          {[-1, 1].map((s) => {
            const r = torsoR(HIP_Y) + 0.042;
            const x = 0.12;
            const z = r * Z_SCALE * Math.sqrt(1 - (x / r) ** 2) + 0.003;
            return (
              <mesh key={s} position={[s * x, 0.93, z]} rotation={[0, s * 0.5, 0]}>
                <boxGeometry args={[0.09, 0.03, 0.006]} />
                <Mat color={shade(o.jacketColor!, 0.95)} roughness={0.75} />
              </mesh>
            );
          })}
        </>
      )}
    </group>
  );
}

function Watch({ color }: { color: string }) {
  return (
    <group position={[0, -0.235, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.041, 0.009, 12, 40]} />
        <Mat color={color} roughness={0.4} sheen={0} />
      </mesh>
      <group position={[0.046, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[0.021, 0.021, 0.012, 32]} />
          <Mat color={METAL} roughness={0.2} metalness={0.9} sheen={0} />
        </mesh>
        <mesh position={[0, -0.0065, 0]}>
          <cylinderGeometry args={[0.017, 0.017, 0.002, 32]} />
          <Mat color="#E9E7E2" roughness={0.15} sheen={0} clearcoat={1} />
        </mesh>
      </group>
    </group>
  );
}

function Arm({ side, o }: { side: 1 | -1; o: Outfit }) {
  const long = o.sleeve === "long";
  const top = o.topColor;
  const jacket = o.jacketColor;
  return (
    <group position={[side * 0.2, 1.405, 0]} rotation={[0, 0, side * 0.1]}>
      <mesh>
        <sphereGeometry args={[0.058, 32, 24]} />
        <Skin />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <capsuleGeometry args={[0.045, 0.24, 8, 24]} />
        <Skin />
      </mesh>
      {!jacket && (
        <mesh>
          <sphereGeometry args={[0.07, 32, 24]} />
          <Mat color={top} />
        </mesh>
      )}
      {long ? (
        <>
          <Tube r1={0.064} r2={0.056} h={0.32} y={-0.15} color={top} />
          <mesh position={[0, -0.3, 0]}>
            <sphereGeometry args={[0.057, 24, 16]} />
            <Mat color={top} />
          </mesh>
        </>
      ) : (
        <Tube r1={0.068} r2={0.062} h={0.17} y={-0.075} color={top} />
      )}
      {jacket && (
        <>
          <mesh position={[0, 0.005, 0]}>
            <sphereGeometry args={[0.084, 32, 24]} />
            <Mat color={jacket} roughness={0.75} sheen={0.45} />
          </mesh>
          <Tube r1={0.078} r2={0.07} h={0.32} y={-0.15} color={jacket} roughness={0.75} />
          <mesh position={[0, -0.3, 0]}>
            <sphereGeometry args={[0.07, 24, 16]} />
            <Mat color={jacket} roughness={0.75} />
          </mesh>
        </>
      )}

      <group position={[0, -0.3, 0]} rotation={[-0.15, 0, 0]}>
        <mesh position={[0, -0.13, 0]}>
          <capsuleGeometry args={[0.038, 0.22, 8, 24]} />
          <Skin />
        </mesh>
        <mesh position={[0, -0.33, 0.004]} scale={[0.62, 1.25, 0.95]}>
          <sphereGeometry args={[0.045, 32, 24]} />
          <Skin />
        </mesh>
        {long && <Tube r1={0.056} r2={0.049} h={0.22} y={-0.105} color={top} />}
        {long && o.topKind === "sweat" && (
          <mesh position={[0, -0.212, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.047, 0.008, 12, 32]} />
            <Mat color={shade(top, 0.9)} roughness={0.95} />
          </mesh>
        )}
        {jacket && <Tube r1={0.07} r2={0.06} h={0.21} y={-0.1} color={jacket} roughness={0.75} />}
        {side === 1 && <Watch color={o.watchColor} />}
      </group>
    </group>
  );
}

function Shoe({ o }: { o: Outfit }) {
  const sneaker = o.shoeStyle === "sneaker";
  const leather = !sneaker;
  const soleH = sneaker ? 0.034 : 0.018;
  const upperY = soleH + 0.034;
  return (
    <group position={[0, 0, 0.035]}>
      <RoundedBox args={[0.106, soleH, 0.29]} radius={Math.min(0.009, soleH / 2 - 0.001)} smoothness={3} position={[0, soleH / 2, 0]}>
        <Mat color={o.soleColor} roughness={sneaker ? 0.7 : 0.45} sheen={0} />
      </RoundedBox>
      <RoundedBox args={[0.096, 0.075, 0.275]} radius={0.034} smoothness={5} position={[0, upperY, -0.004]}>
        <Mat color={o.shoeColor} roughness={leather ? 0.3 : 0.72} sheen={leather ? 0 : 0.4} clearcoat={leather ? 0.7 : 0} />
      </RoundedBox>
      {o.shoeStyle === "formal" && (
        <RoundedBox args={[0.088, 0.022, 0.07]} radius={0.006} smoothness={3} position={[0, 0.011, -0.105]}>
          <Mat color={o.soleColor} roughness={0.45} sheen={0} />
        </RoundedBox>
      )}
      {o.shoeStyle === "loafer" && (
        <RoundedBox args={[0.1, 0.012, 0.032]} radius={0.005} smoothness={3} position={[0, upperY + 0.033, 0.045]}>
          <Mat color={o.soleColor} roughness={0.4} sheen={0} />
        </RoundedBox>
      )}
      {sneaker &&
        [0.02, 0.05, 0.08].map((z) => (
          <mesh key={z} position={[0, upperY + 0.0385, z]}>
            <boxGeometry args={[0.05, 0.004, 0.007]} />
            <Mat color="#F8F8F6" roughness={0.8} sheen={0} />
          </mesh>
        ))}
    </group>
  );
}

function Leg({ side, o }: { side: 1 | -1; o: Outfit }) {
  const hem = o.jeans ? 0.07 : 0.077;
  const lean = Math.atan((0.1 - hem) / 0.88);
  return (
    <group position={[side * 0.088, 0.93, 0]}>
      <Tube r1={0.1} r2={hem} h={0.88} y={-0.41} color={o.bottomColor} roughness={o.jeans ? 0.95 : 0.78} />
      <mesh position={[0, -0.41, (0.1 + hem) / 2 + 0.0015]} rotation={[lean, 0, 0]}>
        <boxGeometry args={[o.jeans ? 0.003 : 0.002, 0.86, 0.003]} />
        {o.jeans ? (
          <Mat color="#C9A25A" roughness={0.8} sheen={0} />
        ) : (
          <meshBasicMaterial color="#000000" transparent opacity={0.18} />
        )}
      </mesh>
      <group position={[side * 0.007, -0.93, 0]}>
        <Shoe o={o} />
      </group>
    </group>
  );
}

function CameraRig({ view }: { view: MannequinProps["view"] }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const goal = useRef<number | null>(null);

  useEffect(() => {
    if (view.key > 0) goal.current = view.azimuth;
  }, [view]);

  useFrame((_, dt) => {
    if (goal.current === null || !controls) return;
    const target = controls.target;
    const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
    const k = 1 - Math.exp(-dt * 6);
    const d = Math.atan2(Math.sin(goal.current - sph.theta), Math.cos(goal.current - sph.theta));
    sph.theta += d * k;
    sph.phi += (PHI - sph.phi) * k;
    sph.radius += (DIST - sph.radius) * k;
    camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(sph));
    camera.lookAt(target);
    if (Math.abs(d) < 0.002 && Math.abs(DIST - sph.radius) < 0.01) goal.current = null;
  });
  return null;
}

export default function Mannequin({ outfit, view, autoRotate }: MannequinProps) {
  const camY = TARGET[1] + DIST * Math.cos(PHI);
  const camZ = DIST * Math.sin(PHI);
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, camY, camZ], fov: 24, near: 0.1, far: 50 }}
      gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}
    >
      <ambientLight intensity={0.25} />
      <directionalLight position={[2.5, 4, 3.5]} intensity={1.6} />
      <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#dfe8ff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 4]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.1} position={[-5, 2, 0]} scale={[4, 4, 1]} />
        <Lightformer form="rect" intensity={1.1} position={[5, 2, 0]} scale={[4, 4, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[0, 2, -5]} scale={[6, 3, 1]} />
      </Environment>

      <group>
        <Head />
        <Torso o={outfit} />
        <Arm side={1} o={outfit} />
        <Arm side={-1} o={outfit} />
        <Leg side={1} o={outfit} />
        <Leg side={-1} o={outfit} />
      </group>

      <mesh position={[0, -0.015, 0]}>
        <cylinderGeometry args={[0.55, 0.57, 0.03, 64]} />
        <meshStandardMaterial color="#E4E0D8" roughness={0.9} />
      </mesh>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.55} scale={2.2} blur={2.4} far={1.2} resolution={512} color="#2a2018" />

      <OrbitControls
        makeDefault
        target={TARGET}
        enablePan={false}
        enableDamping
        minDistance={2.4}
        maxDistance={6}
        minPolarAngle={1.1}
        maxPolarAngle={1.75}
        autoRotate={autoRotate}
        autoRotateSpeed={1.4}
      />
      <CameraRig view={view} />
    </Canvas>
  );
}
