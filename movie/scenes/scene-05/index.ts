import * as THREE from "three";
import { gsap } from "gsap";
import type { SceneModule } from "@movie/types/scene";
import { CinematicStage, ensureThree } from "@movie/lib/three/CinematicStage";
import { startAmbient, startScore, bigImpact, chordGlow } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

/**
 * Scene 05 — Crabtris. 3D edition.
 *
 * Real 3D grid with pieces sliding horizontally across it. Crab floats
 * above the grid and rotates lazily. Camera orbits slightly while a
 * low fog hangs under the playfield.
 *
 * This scene intentionally uses boxes as pieces so we can keep a classic
 * tetris feel while giving it real depth and lighting.
 */

const COLS = 12;
const ROWS = 8;
const CELL = 0.4; // world units per cell
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;

// Pieces are 4-cell shapes. Each pattern lists the target cells. The piece
// starts beyond the left gate and slides horizontally into that target.
interface Pattern {
  cells: [number, number][];
  duration: number;
  color: number;
  label: string;
}
const PATTERNS: Pattern[] = [
  {
    cells: [[8, 0], [9, 0], [8, 1], [9, 1]],
    duration: 0.9,
    color: 0xff8fb6,
    label: "O-BLOCK",
  },
  {
    cells: [[7, 3], [8, 3], [9, 3], [10, 3]],
    duration: 1.0,
    color: 0xffd56b,
    label: "I-BLOCK",
  },
  {
    cells: [[9, 5], [10, 5], [10, 4], [11, 4]],
    duration: 0.95,
    color: 0x82aaff,
    label: "S-BLOCK",
  },
  {
    cells: [[8, 7], [9, 7], [10, 7], [10, 6]],
    duration: 1.0,
    color: 0xc792ea,
    label: "L-BLOCK",
  },
  {
    cells: [[11, 2], [11, 3], [11, 4], [11, 5]],
    duration: 0.9,
    color: 0x6bff95,
    label: "SIDE CLEAR",
  },
];

function cellWorld(c: number, r: number): [number, number] {
  return [
    -BOARD_W / 2 + (c + 0.5) * CELL,
    BOARD_H / 2 - (r + 0.5) * CELL,
  ];
}

function createScene(): SceneModule {
  let stage: CinematicStage | null = null;
  let crab: THREE.Group | null = null;
  let pieceGroup: THREE.Group | null = null;
  const filled: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const settled: THREE.Mesh[] = [];
  const stops: (() => void)[] = [];

  function buildBoard(): THREE.Group {
    const grp = new THREE.Group();

    // Board backing in the same XY plane as the pieces.
    const gridGeo = new THREE.PlaneGeometry(BOARD_W, BOARD_H);
    const gridMat = new THREE.MeshStandardMaterial({
      color: 0x100616,
      emissive: 0x331830,
      roughness: 1,
    });
    const gridPlane = new THREE.Mesh(gridGeo, gridMat);
    gridPlane.position.z = -0.24;
    grp.add(gridPlane);

    // Wireframe grid aligned to the moving blocks.
    const wireMat = new THREE.LineBasicMaterial({
      color: 0xff8fb6,
      transparent: true,
      opacity: 0.35,
    });
    const wireGeo = new THREE.WireframeGeometry(
      new THREE.PlaneGeometry(BOARD_W, BOARD_H, COLS, ROWS),
    );
    const wire = new THREE.LineSegments(wireGeo, wireMat);
    wire.position.z = -0.2;
    grp.add(wire);

    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(BOARD_W + 0.18, BOARD_H + 0.18, 0.08)),
      new THREE.LineBasicMaterial({ color: 0xff8fb6, transparent: true, opacity: 0.9 }),
    );
    border.position.z = -0.16;
    grp.add(border);

    const gateMat = new THREE.MeshBasicMaterial({ color: 0x6bff95 });
    const gate = new THREE.Mesh(new THREE.BoxGeometry(0.08, BOARD_H + 0.8, 0.08), gateMat);
    gate.position.set(-BOARD_W / 2 - 0.36, 0, 0.02);
    grp.add(gate);

    const stackMat = new THREE.MeshBasicMaterial({ color: 0xffd56b });
    const stackRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, BOARD_H + 0.8, 0.08), stackMat);
    stackRail.position.set(BOARD_W / 2 + 0.36, 0, 0.02);
    grp.add(stackRail);

    for (let i = 0; i < 5; i++) {
      const arrow = makeArrow();
      arrow.position.set(-BOARD_W / 2 + 0.65 + i * 0.85, -BOARD_H / 2 - 0.45, 0.04);
      grp.add(arrow);
    }

    return grp;
  }

  function makeArrow(): THREE.Group {
    const arrow = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x6bff95, transparent: true, opacity: 0.78 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 8), mat);
    shaft.rotation.z = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 14), mat);
    head.rotation.z = -Math.PI / 2;
    head.position.x = 0.26;
    arrow.add(shaft, head);
    return arrow;
  }

  function makeCell(c: number, r: number, color: number): THREE.Mesh {
    const [wx, wy] = cellWorld(c, r);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.2,
    });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.92, CELL * 0.92, 0.35),
      mat,
    );
    mesh.position.set(wx, wy, 0);
    return mesh;
  }

  function makeCrab(): THREE.Group {
    // A blocky crab from primitives.
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xff4d4d,
      emissive: 0x661111,
      roughness: 0.4,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 14), bodyMat);
    body.scale.y = 0.7;
    g.add(body);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000 });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), eyeMat);
    eL.position.set(-0.18, 0.35, 0.34);
    const eR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), eyeMat);
    eR.position.set(0.18, 0.35, 0.34);
    g.add(eL, eR);
    // claws
    const clawMat = new THREE.MeshStandardMaterial({ color: 0xff7777, emissive: 0x551111 });
    const cL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), clawMat);
    cL.scale.set(1.4, 1, 1);
    cL.position.set(-0.7, -0.05, 0.2);
    const cR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), clawMat);
    cR.scale.set(1.4, 1, 1);
    cR.position.set(0.7, -0.05, 0.2);
    g.add(cL, cR);
    return g;
  }

  function seedFloor(group: THREE.Group): void {
    const seed: [number, number][] = [
      [11, 0], [11, 1], [11, 6], [11, 7],
      [10, 0], [10, 1], [10, 2], [10, 6],
      [9, 2], [9, 4], [9, 6],
      [8, 2], [8, 4], [8, 6],
    ];
    for (const [c, r] of seed) {
      filled[r][c] = true;
      const m = makeCell(c, r, 0xff8fb6);
      m.material = new THREE.MeshStandardMaterial({
        color: 0xff8fb6,
        emissive: 0x551a35,
        emissiveIntensity: 0.4,
        roughness: 0.4,
      });
      group.add(m);
      settled.push(m);
    }
  }

  const module: SceneModule = {
    config: scene,
    script,

    async preload() {
      await ensureThree();
    },

    create(rootEl) {
      rootEl.style.background = "#160819";
      rootEl.insertAdjacentHTML(
        "beforeend",
        `
          <div class="crabtris-hud">
            <span class="crabtris-mode">CRABTRIS SIDEWAYS</span>
            <strong>000000</strong>
            <span class="crabtris-objective">左侧发射 · 向右堆叠 · 满列清除</span>
          </div>
          <div class="crabtris-lane-label">PUSH RIGHT →</div>
          <div class="crabtris-line-clear">COLUMN CLEAR</div>
        `,
      );
      stage = new CinematicStage(rootEl, {
        fov: 32,
        bloom: 0.7,
        background: 0x140416,
        exposure: 1.05,
      });

      const board = buildBoard();
      stage.scene.add(board);
      seedFloor(board);

      pieceGroup = new THREE.Group();
      stage.scene.add(pieceGroup);

      crab = makeCrab();
      crab.position.set(-BOARD_W / 2 - 0.55, BOARD_H / 2 + 0.45, 0.45);
      stage.scene.add(crab);

      // Initial camera: classic game-camera offset, slightly above board.
      const portrait = rootEl.clientHeight > rootEl.clientWidth;
      stage.camera.position.set(0, 0.25, portrait ? 10.2 : 6.0);
      stage.camera.fov = portrait ? 50 : 32;
      stage.camera.updateProjectionMatrix();
      stage.camera.lookAt(0, 0, 0);

      // Lighter key + warmer rim for the tetris mood.
      stage.keyLight.color.set(0xffc9a3);
      stage.keyLight.position.set(3, 5, 4);
      stage.keyLight.intensity = 0.7;
      stage.rimLight.color.set(0xff8fb6);
      stage.rimLight.position.set(-3, 1, -2);
      stage.rimLight.intensity = 0.8;
      stage.ambient.color.set(0x331830);
      stage.ambient.intensity = 0.3;

      stage.start();

      // Audio: chiptune ambient bed.
      stops.push(startAmbient("chiptune", 0.06));
      stops.push(startScore("arcade", 0.035));
    },

    async warmup() {
      if (!stage) return;
      await stage.warmup(5);
    },

    play(tl) {
      if (!stage || !crab || !pieceGroup) return;
      const camera = stage.camera;
      const host = stage.renderer.domElement.parentElement;
      const hud = host?.querySelector(".crabtris-hud") as HTMLElement | null;
      const scoreEl = host?.querySelector(".crabtris-hud strong") as HTMLElement | null;
      const clearEl = host?.querySelector(".crabtris-line-clear") as HTMLElement | null;
      const laneLabel = host?.querySelector(".crabtris-lane-label") as HTMLElement | null;
      const portrait = Boolean(host && host.clientHeight > host.clientWidth);
      const cameraStart = portrait
        ? { x: -0.1, y: 0.2, z: 10.2 }
        : { x: -0.2, y: 0.25, z: 6.0 };
      const cameraEnd = portrait
        ? { x: 0.25, y: 0.08, z: 9.2 }
        : { x: 0.45, y: 0.15, z: 5.25 };
      // Subtle isometric dolly.
      tl.fromTo(
        camera.position,
        cameraStart,
        { ...cameraEnd, duration: scene.duration, ease: "sine.inOut" },
        0,
      );
      tl.fromTo(
        camera,
        { fov: portrait ? 50 : 32 },
        {
          fov: portrait ? 46 : 35,
          duration: scene.duration,
          onUpdate() {
            camera.updateProjectionMatrix();
          },
        },
        0,
      );
      if (hud) {
        tl.fromTo(hud, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.45 }, 0.6);
      }
      if (laneLabel) {
        tl.fromTo(laneLabel, { opacity: 0, x: -18 }, { opacity: 1, x: 0, duration: 0.45 }, 0.85);
      }

      // Crab: patrols the left launcher and shoves pieces into the board.
      tl.fromTo(
        crab.position,
        { x: -BOARD_W / 2 - 0.65 },
        { x: -BOARD_W / 2 + 0.25, duration: 0.45, yoyo: true, repeat: 11, ease: "power2.inOut" },
        1.0,
      );
      tl.to(crab.rotation, { z: Math.PI * 0.12, duration: 0.3, yoyo: true, repeat: 16 }, 1.0);

      let tCursor = 1.15;
      let score = 0;

      PATTERNS.forEach((p) => {
        // Blocks launch from the left gate into their target cells.
        const ghosts: THREE.Mesh[] = [];
        p.cells.forEach(([c, r]) => {
          const m = makeCell(c, r, p.color);
          m.material = new THREE.MeshStandardMaterial({
            color: p.color,
            emissive: p.color,
            emissiveIntensity: 0.9,
            transparent: true,
            opacity: 0.6,
          });
          m.position.x -= BOARD_W + 0.9;
          pieceGroup!.add(m);
          ghosts.push(m);
        });

        const startAt = tCursor;

        ghosts.forEach((m, idx) => {
          const [targetX, targetY] = cellWorld(p.cells[idx][0], p.cells[idx][1]);
          m.position.y = targetY;
          tl.to(
            m.position,
            { x: targetX, duration: p.duration, ease: "steps(5)" },
            startAt + idx * 0.025,
          );
          tl.to(m.rotation, { z: "+=0.12", duration: 0.12, yoyo: true, repeat: 3 }, startAt + 0.1);
        });

        const commitAt = startAt + p.duration + 0.05;
        tl.call(() => {
          ghosts.forEach((m) => m.remove());
          for (const [c, r] of p.cells) {
            if (r >= 0 && r < ROWS) {
              filled[r][c] = true;
              const sm = makeCell(c, r, p.color);
              pieceGroup!.add(sm);
              settled.push(sm);
            }
          }
          score += 100;
          if (scoreEl) scoreEl.textContent = String(score).padStart(6, "0");
        }, [], commitAt);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tl as any).call(() => bigImpact(), [], commitAt);

        tCursor = commitAt + 0.16;
      });

      // Clear a vertical column: the horizontal version's equivalent of a line clear.
      tl.call(() => {
        for (let c = COLS - 1; c >= 0; c--) {
          if (filled.every((row) => row[c])) {
            const clearing: THREE.Mesh[] = [];
            for (let r = 0; r < ROWS; r++) {
              const idx = settled.findIndex(
                (m) => Math.abs(m.position.x - cellWorld(c, r)[0]) < 0.01
                  && Math.abs(m.position.y - cellWorld(c, r)[1]) < 0.01,
              );
              if (idx >= 0) {
                const m = settled[idx];
                settled.splice(idx, 1);
                clearing.push(m);
              }
              filled[r][c] = false;
            }
            clearing.forEach((m, i) => {
              const mat = m.material as THREE.MeshStandardMaterial;
              mat.transparent = true;
              gsap.to(m.position, { z: 0.55, duration: 0.16, yoyo: true, repeat: 1, delay: i * 0.025 });
              gsap.to(m.rotation, { z: "+=0.45", duration: 0.34, delay: i * 0.025 });
              gsap.to(m.scale, {
                x: 0.02,
                y: 0.02,
                z: 1.9,
                duration: 0.46,
                ease: "power3.in",
                delay: 0.14 + i * 0.035,
              });
              gsap.to(mat, {
                opacity: 0,
                emissiveIntensity: 2.4,
                duration: 0.42,
                delay: 0.12 + i * 0.035,
                onComplete() {
                  m.removeFromParent();
                  mat.dispose();
                  m.geometry.dispose();
                },
              });
            });
            score += 800;
            if (scoreEl) scoreEl.textContent = String(score).padStart(6, "0");
            break;
          }
        }
      }, [], 8.45);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tl as any).call(() => chordGlow(), [], 8.45);
      if (clearEl) {
        tl.fromTo(clearEl, { opacity: 0, scale: 0.82 }, { opacity: 1, scale: 1, duration: 0.28 }, 8.45);
        tl.to(clearEl, { opacity: 0, scale: 1.12, duration: 0.75 }, 9.15);
      }

      // Slow final push-in.
      tl.to(camera.position, { z: portrait ? 8.6 : 4.55, duration: 3.4, ease: "power2.inOut" }, 8.6);
    },

    pause() {},

    destroy() {
      while (stops.length) stops.pop()!();
      if (stage) {
        stage.dispose();
        stage = null;
      }
      pieceGroup = null;
      crab = null;
      settled.length = 0;
    },
  };

  return module;
}

export default createScene();
