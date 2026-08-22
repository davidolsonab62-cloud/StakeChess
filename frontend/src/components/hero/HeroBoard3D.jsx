import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useProgress, Environment, ContactShadows } from "@react-three/drei";
import { useSpring, animated } from "@react-spring/three";
import * as THREE from "three";
import { useTheme } from "@/context/ThemeContext";

/* Phase 3 adds @react-spring/three as a new dependency (not used by
   Phases 1-2) so the tilt and hero-move animations can run on the
   exact same damped-harmonic-oscillator spring model framer-motion's
   useSpring uses in the CSS version — react-spring's `tension`/
   `friction` are that same physics' `stiffness`/`damping`, just
   renamed, so the values below are carried over directly rather than
   re-tuned. `npm install @react-spring/three` if it isn't already a
   dependency. */

/* ---------------------------------------------------------------
   Phase 2 — real assets (board + pieces).

   Model: "Realistic Chess Set 3D Model" by noob-3d on Sketchfab
   (https://sketchfab.com/3d-models/realistic-chess-set-3d-model-a07b3ac3f57f4fa3822e3f2d6241a7b0),
   licensed CC-BY-4.0 — ATTRIBUTION REQUIRED. This isn't optional
   under that license: add a visible credit somewhere a visitor can
   find it (a footer line, an /about or /credits page, etc.), not
   just this code comment. Something like:
   "Chess set model by noob-3d (Sketchfab), CC BY 4.0."
   (Done — see the footer credit line added to Landing.jsx.)

   Phase 4 — Draco-compressed via `gltf-transform draco` into a
   single .glb (48.55 MB source scene.gltf+scene.bin -> 4.45 MB),
   so this now points at one file instead of the original
   scene.gltf + scene.bin + textures/*.png set. drei's useGLTF sets
   up a DRACOLoader pointed at Google's hosted decoder
   (gstatic.com/draco) automatically, so no loader config changed on
   this end — same useGLTF call, just a different URL. The original
   uncompressed scene.gltf/.bin/textures are left in place alongside
   this file rather than deleted, in case the compressed geometry
   ever needs re-deriving from source.

   Place the compressed file at:
     public/models/chess-set/scene-compressed.glb
   --------------------------------------------------------------- */
const MODEL_URL = "/models/chess-set/scene-compressed.glb";

const BOARD_SIZE = 8;
const CENTER_OFFSET = (BOARD_SIZE - 1) / 2;

/* Hero piece data — duplicated from HERO_PIECES in Landing.jsx (see
   the Phase 1 note in the previous version of this file), now with a
   `type` field added so we know which mesh to pull from the model
   for each entry. tone "light"/"dark" maps to the model's White/
   Black variants, same convention the CSS glyph renderer used. */
const HERO_PIECES = [
  { type: "k", f: 4, r: 3, size: 1.0, tone: "dark", hero: true }, // king
  { type: "n", f: 2, r: 4, size: 0.52, tone: "light" }, // knight
  { type: "b", f: 6, r: 4, size: 0.48, tone: "light" }, // bishop
  { type: "r", f: 1, r: 2, size: 0.42, tone: "dark" }, // rook
  { type: "p", f: 5, r: 5, size: 0.34, tone: "light" }, // pawn
  { type: "p", f: 3, r: 5, size: 0.34, tone: "dark" }, // pawn
];

/* Phase 5 — the king (HERO_PIECES[0]) never appears as a
   MOVE_SEQUENCES pieceIndex below, so its square is fixed for the
   component's whole lifetime; the glow decal/point-light can use a
   plain constant instead of tracking Piece's live spring position.
   Same (f - CENTER_OFFSET) / (CENTER_OFFSET - r) mapping Piece uses
   for its own targetX/targetZ. */
const KING_WORLD_X = HERO_PIECES[0].f - CENTER_OFFSET;
const KING_WORLD_Z = CENTER_OFFSET - HERO_PIECES[0].r;

/* Phase 3 — hero move sequences. Duplicated from MOVE_SEQUENCES in
   Landing.jsx, same order/pieceIndex convention as that file (index
   into HERO_PIECES above, which mirrors Landing.jsx's array 1:1) so
   the exact same "one random move on load" behavior applies here. */
const MOVE_SEQUENCES = [
  { pieceIndex: 1, toF: 4, toR: 5 }, // knight hops toward center
  { pieceIndex: 2, toF: 3, toR: 1 }, // bishop cuts across the diagonal
  { pieceIndex: 3, toF: 1, toR: 6 }, // rook slides down the file
  { pieceIndex: 4, toF: 5, toR: 4 }, // pawn advances one
  { pieceIndex: 5, toF: 2, toR: 4 }, // pawn advances toward the knight
  { pieceIndex: 2, toF: 4, toR: 6 }, // bishop threatens deep
];

/* Maps HERO_PIECES `type` + `tone` to the exact node name in
   scene.gltf. Confirmed by inspecting the file directly:
     Black/White King, Black/White Queen,
     Black/White {Bishop,Horse,Rook} {Left,Right},
     Black/White Pawn(.001-.007), Bord (the board itself, unused here
     — see note below).
   Bishop/knight/rook each have Left+Right copies from the starting
   position; the hero board only ever needs one of each, so "Left"
   is picked arbitrarily. The mesh's own node name has a
   "_all Metarial_0" suffix (that's how the exporter named the child
   mesh under each piece's transform group) — that's what carries
   the actual geometry, so that's what we clone. */
const MESH_NODE_BY_TYPE_TONE = {
  k: { light: "White King_all Metarial_0", dark: "Black King_all Metarial_0" },
  q: { light: "White Queen_all Metarial_0", dark: "Black Queen_all Metarial_0" },
  n: { light: "White Horse Left_all Metarial_0", dark: "Black Horse Left_all Metarial_0" },
  b: { light: "White Bishop Left_all Metarial_0", dark: "Black Bishop Left_all Metarial_0" },
  r: { light: "White Rook Left_all Metarial_0", dark: "Black Rook Left_all Metarial_0" },
  p: { light: "White Pawn_all Metarial_0", dark: "Black Pawn_all Metarial_0" },
};

useGLTF.preload(MODEL_URL);

/* Phase 3 — tilt tuning. Same max degrees as the CSS version's
   rawRotateX/rawRotateY (pointer: 9deg, device: 6deg) so the feel
   stays close, just converted to radians and applied as real
   rotation on a group instead of a CSS transform. */
const POINTER_MAX_TILT_RAD = THREE.MathUtils.degToRad(9);
const DEVICE_MAX_TILT_RAD = THREE.MathUtils.degToRad(6);

// Exact same spring physics as the CSS version's tilt
// (useSpring(rawRotateX/Y, { stiffness: 120, damping: 16 })).
const TILT_SPRING_CONFIG = { mass: 1, tension: 120, friction: 16 };

// Exact same spring physics as the CSS version's hero-move tween
// (transition={{ type: "spring", stiffness: 85, damping: 15 }}).
const MOVE_SPRING_CONFIG = { mass: 1, tension: 85, friction: 15 };

// Idle-float sine bob — same period/stagger as the CSS keyframe
// (`y: [0, -4, 0]`, duration `3.2 + i * 0.4`, delay `i * 0.25`).
const IDLE_FLOAT_BASE_PERIOD = 3.2;
const IDLE_FLOAT_PERIOD_STEP = 0.4;
const IDLE_FLOAT_DELAY_STEP = 0.25;

/**
 * Reads a CSS custom property off :root as a plain color string, so
 * the three.js materials (which can't read CSS vars directly) stay
 * in sync with the current theme. Re-reads whenever `theme` changes.
 */
function useCssVar(name, fallback, theme) {
  const value = useMemo(() => {
    if (typeof window === "undefined") return fallback;
    const computed = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return computed || fallback;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, fallback, theme]);
  return value;
}

/* Phase 3 — mirrors framer-motion's useReducedMotion: read the OS
   preference once, then stay in sync if the user changes it mid-
   session. Every animation below (tilt, hero move, idle float)
   checks this and no-ops when true, same as the CSS version. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setReduced(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  return reduced;
}

/**
 * Phase 3 — pointer-tilt + device-tilt parallax, on a real spring.
 * Ported from the CSS version's rawRotateX/rawRotateY motion values:
 * there, `.set()` on a motion value feeds a useSpring without
 * triggering a React re-render on every mousemove; here, `api.start()`
 * on a react-spring imperative handle does the same job. Includes the
 * iOS permission-on-first-gesture pattern for device orientation.
 *
 * Axis mapping: the board sits on the horizontal X-Z plane, so "tilt
 * toward the cursor" comes from rotating around the plane's own
 * in-plane axes — X (pitch, tips the near/far edge) for vertical
 * pointer movement, Z (roll, tips the left/right edge) for horizontal
 * movement. Rotating around the vertical Y axis instead (yaw) would
 * just spin the flat plane in place and barely read as a tilt at all,
 * so that's deliberately not used here. The fixed camera sits on a
 * diagonal rather than square-on to either axis, so this is a good
 * approximation rather than a screen-perfect one — flip the sign
 * below if the roll direction feels backwards once you see it move.
 */
function useBoardTilt(prefersReducedMotion) {
  const [{ rx, rz }, api] = useSpring(() => ({
    rx: 0,
    rz: 0,
    config: TILT_SPRING_CONFIG,
  }));

  const handlePointerMove = (e) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    api.start({ rz: px * POINTER_MAX_TILT_RAD, rx: py * -POINTER_MAX_TILT_RAD });
  };

  const handlePointerLeave = () => {
    api.start({ rx: 0, rz: 0 });
  };

  // Device-tilt parallax on mobile — same gated-permission dance as
  // the CSS version: browsers that expose orientation events freely
  // get it immediately; iOS 13+ Safari gates it behind
  // DeviceOrientationEvent.requestPermission(), which only resolves
  // inside a user gesture, so we piggyback on the visitor's first
  // tap/touch anywhere on the page rather than showing our own
  // "enable motion?" prompt.
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (typeof window === "undefined" || !window.DeviceOrientationEvent) return;

    const handleOrientation = (e) => {
      if (e.beta == null || e.gamma == null) return;
      const clampedBeta = Math.max(-20, Math.min(20, e.beta - 45));
      const clampedGamma = Math.max(-20, Math.min(20, e.gamma));
      api.start({
        rx: (clampedBeta / 20) * -DEVICE_MAX_TILT_RAD,
        rz: (clampedGamma / 20) * DEVICE_MAX_TILT_RAD,
      });
    };

    if (typeof window.DeviceOrientationEvent.requestPermission !== "function") {
      window.addEventListener("deviceorientation", handleOrientation);
      return () => window.removeEventListener("deviceorientation", handleOrientation);
    }

    let cancelled = false;
    const requestOnGesture = () => {
      window.DeviceOrientationEvent.requestPermission()
        .then((state) => {
          if (!cancelled && state === "granted") {
            window.addEventListener("deviceorientation", handleOrientation);
          }
        })
        .catch(() => {
          /* denied or unsupported — board stays untilted, no retry/nag */
        });
    };
    window.addEventListener("touchstart", requestOnGesture, { once: true, passive: true });
    window.addEventListener("pointerdown", requestOnGesture, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("touchstart", requestOnGesture);
      window.removeEventListener("pointerdown", requestOnGesture);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [prefersReducedMotion, api]);

  return { rx, rz, handlePointerMove, handlePointerLeave };
}

/* Phase 4 — tracks whether the board's container is actually on
   screen, so the Canvas below can drop its render loop entirely
   while scrolled out of view rather than continuing to burn GPU/
   battery on an off-screen animation nobody sees (idle float + the
   tilt/move springs all run every frame via useFrame). Defaults to
   `true` rather than `false` — the hero board is normally visible on
   initial mount (it's above the fold), so starting "visible" avoids
   waiting a tick for the observer's first callback before the very
   first frame renders; if it mounts already-offscreen for some
   reason, the observer's first callback corrects it a moment later.
   threshold: 0 (not e.g. 0.1) so the board keeps animating until
   truly zero pixels are visible, rather than stopping slightly early
   while still partially in view. */
function useInViewport() {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !window.IntersectionObserver) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, isVisible];
}

/* Procedural board squares, kept from Phase 1 rather than the
   model's own "Bord" mesh — the model's board has its checker
   pattern baked into the texture, so it can't follow --sq-light/
   --sq-dark when the user toggles theme. This stays the
   theme-reactive board; the model only supplies the pieces.
   (Flagging this as a decision, not an oversight — if you'd rather
   use the model's real board and drop theme-reactive squares, say
   so and I'll swap it in Phase 2b.) */
function BoardSquares({ lightColor, darkColor }) {
  const squares = useMemo(() => {
    const arr = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let f = 0; f < BOARD_SIZE; f++) {
        arr.push({ f, r, isLight: (f + r) % 2 === 0 });
      }
    }
    return arr;
  }, []);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {squares.map(({ f, r, isLight }) => (
        <mesh key={`${f}-${r}`} position={[f - CENTER_OFFSET, r - CENTER_OFFSET, 0]}>
          <planeGeometry args={[0.96, 0.96]} />
          <meshStandardMaterial
            color={isLight ? lightColor : darkColor}
            roughness={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Phase 5 — a soft radial-gradient texture generated once on a
 * throwaway 2D canvas, used as the alpha shape for the king-square
 * glow decal below. Three.js has no built-in "soft circle" primitive
 * — this is the standard workaround (bake a gradient to a canvas,
 * hand it to CanvasTexture) rather than pulling in an image asset
 * for one small effect.
 */
function useGlowTexture() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.28)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);
}

/* Phase 5 — the purple ambient glow pooling under the king's square,
   same idea as the CSS version's radial-gradient glow behind the
   king glyph. Two parts working together: a flat additive decal (so
   it reads immediately, independent of light falloff/exposure) plus
   a real point light (so it actually tints the king piece and the
   squares immediately around it, which the decal alone can't do
   since it sits flush on the board, below the piece). */
function KingGlow({ color }) {
  const glowTexture = useGlowTexture();
  if (!glowTexture) return null;

  return (
    <>
      <group position={[KING_WORLD_X, 0.008, KING_WORLD_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <planeGeometry args={[1.9, 1.9]} />
          <meshBasicMaterial
            map={glowTexture}
            color={color}
            transparent
            opacity={0.6}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
      <pointLight
        position={[KING_WORLD_X, 0.45, KING_WORLD_Z]}
        color={color}
        intensity={1.1}
        distance={2.4}
        decay={2}
      />
    </>
  );
}

/* Phase 5 — a thin gold frame around the 8x8 grid, matching the
   reference image's board-edge trim. Built as a flat square ring
   (outer square with an inner square hole) via THREE.Shape rather
   than pulled from the model's own board — we opted out of the
   model's baked "Bord" mesh back in Phase 2 specifically to keep the
   squares theme-reactive, so anything visual on the board surface
   from here on has to be procedural too, this trim included.
   goldTint is a single color driving both the material's base color
   and (dimly) its emissive — the emissive component is what reads as
   "warm metal catching light" in the dark theme against a near-black
   backdrop, where relying on scene lighting alone leaves it looking
   flat/unlit at the grazing angle the fixed camera views it from. */
function BoardFrame({ goldTint }) {
  const shape = useMemo(() => {
    const outer = CENTER_OFFSET + 0.62;
    const inner = CENTER_OFFSET + 0.46;
    const s = new THREE.Shape();
    s.moveTo(-outer, -outer);
    s.lineTo(outer, -outer);
    s.lineTo(outer, outer);
    s.lineTo(-outer, outer);
    s.lineTo(-outer, -outer);
    const hole = new THREE.Path();
    hole.moveTo(-inner, -inner);
    hole.lineTo(inner, -inner);
    hole.lineTo(inner, inner);
    hole.lineTo(-inner, inner);
    hole.lineTo(-inner, -inner);
    s.holes.push(hole);
    return s;
  }, []);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0]}>
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color={goldTint}
          emissive={goldTint}
          emissiveIntensity={0.18}
          metalness={0.75}
          roughness={0.28}
        />
      </mesh>
    </group>
  );
}

/**
 * Clones one piece mesh from the loaded model and normalizes it so
 * every piece ends up `targetHeight` tall, standing on y=0, centered
 * on x/z=0 — regardless of whatever scale/pivot the model was
 * exported with. We don't have the model's binary geometry to
 * inspect ahead of time, so this measures the real bounding box at
 * runtime instead of relying on a hand-picked scale factor. Flagging
 * per the phase brief: if pieces come in looking too large/small
 * relative to each other, it's this normalization to revisit, not
 * the source data.
 */
function useNormalizedPiece(sourceMesh, targetHeight) {
  return useMemo(() => {
    if (!sourceMesh) return null;
    const mesh = sourceMesh.clone();
    mesh.geometry = sourceMesh.geometry.clone();

    // Phase 5 — Object3D.clone() (above) doesn't deep-clone
    // materials, so without this every piece sharing a source node
    // would share one material instance; cloning it here lets each
    // piece's material be tuned independently later if needed, and
    // is where the roughness/metalness dial-in happens now.
    //
    // Values are scalar multipliers against the model's existing
    // metallicRoughness texture (three.js multiplies `roughness`
    // against the map's green channel, `metalness` against blue) —
    // this tunes the look without touching the source texture, same
    // "don't edit the base textures" spirit as the board-trim
    // tinting below. Staunton pieces read as polished wood/resin:
    // a fairly low, tight roughness for a visible but soft highlight
    // (not mirror-glossy plastic), and metalness kept low since wood/
    // resin isn't a metal, just has a top coat that catches light.
    // These are a starting point — nudge to taste once you can see
    // it rendered; screenshot before/after if you want a second
    // opinion on the exact numbers.
    const applyMaterialTuning = (mat) => {
      const cloned = mat.clone();
      if ("roughness" in cloned) cloned.roughness = Math.min(cloned.roughness ?? 1, 0.32);
      if ("metalness" in cloned) cloned.metalness = Math.min(cloned.metalness ?? 0, 0.08);
      return cloned;
    };
    if (Array.isArray(sourceMesh.material)) {
      mesh.material = sourceMesh.material.map(applyMaterialTuning);
    } else if (sourceMesh.material) {
      mesh.material = applyMaterialTuning(sourceMesh.material);
    }

    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = size.y > 0 ? targetHeight / size.y : 1;
    mesh.geometry.scale(scale, scale, scale);

    // Re-measure after scaling, then recenter horizontally and drop
    // the base to y=0 so the board-placement math below stays simple
    // (position = board coordinate, no per-piece offset fudging).
    const box2 = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    mesh.geometry.translate(-center.x, -box2.min.y, -center.z);

    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }, [sourceMesh, targetHeight]);
}

function Piece({ pc, index, nodes, prefersReducedMotion }) {
  const nodeName = MESH_NODE_BY_TYPE_TONE[pc.type]?.[pc.tone];
  const sourceMesh = nodeName ? nodes[nodeName] : null;
  const targetHeight = pc.size * 2.2; // same sizing scale Phase 1 used for the cones

  const normalized = useNormalizedPiece(sourceMesh, targetHeight);
  const groupRef = useRef();

  // Idle-float amplitude scaled to piece size so bigger pieces (the
  // king) bob by roughly the same *proportion* as smaller ones,
  // rather than the CSS version's identical 4px offset for every
  // piece regardless of size — that worked there because the flat
  // glyphs were all similar screen sizes; here pieces have real,
  // very different physical heights.
  const idleAmplitude = pc.size * 0.09;
  const idlePeriod = IDLE_FLOAT_BASE_PERIOD + index * IDLE_FLOAT_PERIOD_STEP;
  const idleDelay = index * IDLE_FLOAT_DELAY_STEP;

  // Board coordinates this piece currently belongs on. Squares live
  // in world space via BoardSquares' own -90deg X-rotated group
  // (local y -> world z = -(r-C)); pieces sit directly in world
  // space, so they use the same (C - r) mapping to land on the same
  // square rather than mirroring across the rank axis.
  const targetX = pc.f - CENTER_OFFSET;
  const targetZ = CENTER_OFFSET - pc.r;

  // Home-square tween, on the exact same spring physics as the CSS
  // version's hero-move transition (stiffness 85 / damping 15). This
  // re-runs automatically whenever targetX/targetZ change — i.e. when
  // ChessPieces applies the hero move — so there's no manual "animate
  // from A to B" bookkeeping needed here.
  const { x, z } = useSpring({
    x: targetX,
    z: targetZ,
    config: MOVE_SPRING_CONFIG,
  });

  // Idle float is a continuous sine wave, not a spring settle, so it
  // still runs per-frame via useFrame — it only ever touches
  // position.y, which the spring above never writes to, so the two
  // don't fight over the same property.
  useFrame((state) => {
    if (!groupRef.current) return;
    if (prefersReducedMotion) {
      groupRef.current.position.y = 0;
      return;
    }
    const t = state.clock.elapsedTime - idleDelay;
    if (t <= 0) {
      groupRef.current.position.y = 0;
      return;
    }
    const phase = (t / idlePeriod) * Math.PI * 2;
    groupRef.current.position.y = idleAmplitude * (0.5 - 0.5 * Math.cos(phase));
  });

  if (!normalized) {
    if (!sourceMesh && typeof console !== "undefined") {
      console.warn(`[HeroBoard3D] No mesh found for node "${nodeName}" — check MESH_NODE_BY_TYPE_TONE against the model's actual node names.`);
    }
    return null;
  }

  return (
    <animated.group ref={groupRef} position-x={x} position-y={0} position-z={z}>
      <primitive object={normalized} />
    </animated.group>
  );
}

function ChessPieces({ prefersReducedMotion }) {
  const { nodes } = useGLTF(MODEL_URL);

  // Phase 3 — one random move picked on mount (stable for this
  // component's lifetime, same lazy-useState pattern Landing.jsx's
  // HeroBoard uses) and applied ~1.1s later, same timing as the CSS
  // version. Skipped entirely under reduced motion, so the piece just
  // stays on its starting square, matching the CSS behavior.
  const [move] = useState(
    () => MOVE_SEQUENCES[Math.floor(Math.random() * MOVE_SEQUENCES.length)]
  );
  const [pieces, setPieces] = useState(() => HERO_PIECES.map((pc) => ({ ...pc })));

  useEffect(() => {
    if (prefersReducedMotion) return;
    const t = setTimeout(() => {
      setPieces((prev) =>
        prev.map((pc, i) =>
          i === move.pieceIndex ? { ...pc, f: move.toF, r: move.toR } : pc
        )
      );
    }, 1100);
    return () => clearTimeout(t);
  }, [move, prefersReducedMotion]);

  return (
    <>
      {pieces.map((pc, i) => (
        <Piece key={i} pc={pc} index={i} nodes={nodes} prefersReducedMotion={prefersReducedMotion} />
      ))}
    </>
  );
}

/* Phase 3 — wraps the board (squares + pieces) so pointer/device tilt
   rotates the whole thing together as one physical object, the same
   way the CSS version tilted a single wrapper div. rx/rz are the
   live react-spring values from useBoardTilt, bound directly — no
   per-frame bookkeeping needed here. */
function TiltGroup({ rx, rz, children }) {
  return (
    <animated.group rotation-x={rx} rotation-z={rz}>
      {children}
    </animated.group>
  );
}

function Scene({ lightColor, darkColor, rx, rz, prefersReducedMotion, isDark, brandColor, goldColor }) {
  // Phase 5 — same idea as the CSS version reading --sq-light/
  // --sq-dark per theme: the dark theme needs more contrast/punch to
  // read against a near-black panel, the light theme needs a gentler
  // touch since the panel itself is already bright. Tuned by eye
  // against the two reference screenshots — nudge freely.
  const envIntensity = isDark ? 1.05 : 0.7;
  const keyIntensity = isDark ? 1.5 : 1.05;
  const fillIntensity = isDark ? 0.35 : 0.3;

  return (
    <>
      {/* Phase 5 — real HDRI environment (Poly Haven "Studio Small
          02", 1K .hdr) replaces the Phase 2 placeholder three-point
          setup, giving the pieces' clearcoat material real specular
          highlights/reflections instead of only diffuse lighting.
          Both this and ChessPieces' model load asynchronously, so
          they share one Suspense boundary below — board squares and
          the frame are procedural (not async) and render immediately
          regardless. */}
      <Suspense fallback={null}>
        <Environment files="/hdri/studio_small_02_1k.hdr" environmentIntensity={envIntensity} />
      </Suspense>

      {/* Key + fill kept alongside the HDRI (not replaced by it) —
          the HDRI alone reads a little soft on the king's crown edge
          without a directional light to sharpen it. Fill is tinted
          very slightly toward brandColor rather than staying pure
          white — this is the "color grading via lighting, not
          textures" the brief asks for: a light color pass rather
          than repainting any material. */}
      <directionalLight position={[-6, 9, 5]} intensity={keyIntensity} />
      <directionalLight position={[6, 4, -4]} intensity={fillIntensity} color={brandColor} />

      <TiltGroup rx={rx} rz={rz}>
        <BoardSquares lightColor={lightColor} darkColor={darkColor} />
        <BoardFrame goldTint={goldColor} />
        <KingGlow color={brandColor} />

        {/* Phase 5 — soft contact/blob shadows grounding each piece.
            Rendered as its own offscreen pass (not the real-time
            shadow-map system, which is why Piece's castShadow/
            receiveShadow stayed false back in Phase 2) — cheaper, and
            all we need for a fixed top-down-ish hero shot. Slightly
            darker/more opaque in the dark theme, same reasoning as
            the light intensities above: more contrast needed against
            a near-black panel for the shadow to read at all. */}
        <ContactShadows
          position={[0, 0.002, 0]}
          opacity={isDark ? 0.55 : 0.32}
          scale={9}
          blur={2.4}
          far={2.2}
          resolution={512}
          color="#000000"
        />

        <Suspense fallback={null}>
          <ChessPieces prefersReducedMotion={prefersReducedMotion} />
        </Suspense>
      </TiltGroup>
    </>
  );
}

/* HTML loading skeleton shown until the model finishes loading, so
   there's no flash of an empty/wrong-looking scene. Uses drei's
   global loading-manager progress rather than anything scoped to
   this Canvas specifically — fine as long as this is the only glTF
   asset the page loads at the same time. */
function LoadingSkeleton({ isDark }) {
  const { active } = useProgress();
  if (!active) return null;
  return (
    <div
      className="absolute inset-0"
      style={{
        background: isDark
          ? "linear-gradient(150deg, #2C2648 0%, #171328 55%, #0D0A1B 100%)"
          : "linear-gradient(150deg, #FEFEFF 0%, #EEECFB 55%, #E1DEF4 100%)",
      }}
    />
  );
}

export default function HeroBoard3D() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const prefersReducedMotion = usePrefersReducedMotion();

  const lightColor = useCssVar("--sq-light", "#EFEAFA", theme);
  const darkColor = useCssVar("--sq-dark", "#2C2648", theme);
  // Phase 5 — --brand already exists per the original constraints
  // (used elsewhere across the app); --gold-trim is new here and
  // almost certainly isn't defined as a CSS var yet, so this falls
  // back to a plain hex. Add a --gold-trim var alongside --sq-light/
  // --sq-dark if you want the trim theme-tunable from CSS the same
  // way the squares are, rather than living only as this fallback.
  const brandColor = useCssVar("--brand", "#7C5CFC", theme);
  const goldColor = useCssVar("--gold-trim", "#D4AF37", theme);

  const { rx, rz, handlePointerMove, handlePointerLeave } =
    useBoardTilt(prefersReducedMotion);

  // Phase 4 — pause the render loop entirely while scrolled out of view.
  const [containerRef, isInView] = useInViewport();

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square"
      style={{ borderRadius: "20%", overflow: "hidden" }}
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Canvas
        // Same fixed three-quarter angle as Phase 1 (~37° above
        // horizontal), approximating the old rotateX(52)/rotateZ(45)
        // CSS look. OrbitControls removed per Phase 2's brief — the
        // Phase 3 pointer/device tilt above is the only camera-ish
        // motion now, applied to the board group rather than the
        // camera itself so the fixed hero framing never changes.
        camera={{ position: [5.5, 6, 5.5], fov: 35 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        // Phase 4 — "always" (r3f's default) renders every frame,
        // which is what the tilt springs + idle float need while
        // visible; "never" stops the render loop completely rather
        // than just throttling it, so an off-screen hero costs
        // nothing. Switching back to "always" on scroll-back-into-
        // view picks the animations back up seamlessly since none of
        // the underlying state (spring targets, elapsed clock time)
        // was reset in between — only the drawing stopped.
        frameloop={isInView ? "always" : "never"}
      >
        <Scene
          lightColor={lightColor}
          darkColor={darkColor}
          rx={rx}
          rz={rz}
          prefersReducedMotion={prefersReducedMotion}
          isDark={isDark}
          brandColor={brandColor}
          goldColor={goldColor}
        />
      </Canvas>
      <LoadingSkeleton isDark={isDark} />
    </div>
  );
}
