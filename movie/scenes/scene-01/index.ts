import * as THREE from "three";
import { gsap } from "gsap";
import type { SceneModule } from "@movie/types/scene";
import { CinematicStage, ensureThree } from "@movie/lib/three/CinematicStage";
import { startRain, startScore, bigImpact, chordGlow } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

/**
 * Scene 01 — The Hacker. 3D edition.
 *
 * We build a small dark room in three dimensions. The monitor sits on a
 * desk; the engineer is a silhouette in front of it, backlit by the
 * screen. Camera dollies slowly toward the monitor.
 *
 * Code typing is rendered to an offscreen <canvas> each frame and
 * uploaded as a `CanvasTexture` to the monitor face — so the screen
 * itself actually changes, not just a CSS overlay.
 */

const PY_LINES: string[] = [
  "from typing import List",
  "",
  "def find_duplicates(nums: List[int]) -> List[int]:",
  "    seen: set[int] = set()",
  "    dups: List[int] = []",
  "    for n in nums:",
  "        if n in seen and n not in dups:",
  "            dups.append(n)",
  "        seen.add(n)",
  "    return dups",
  "",
  'if __name__ == "__main__":',
  "    print(find_duplicates([1, 2, 3, 2, 4, 5, 1]))",
];

const GO_LINES: string[] = [
  "package main",
  "",
  'import "fmt"',
  "",
  "func findDuplicates(nums []int) []int {",
  "    seen := make(map[int]bool)",
  "    var dups []int",
  "    for _, n := range nums {",
  "        if seen[n] && !contains(dups, n) {",
  "            dups = append(dups, n)",
  "        }",
  "        seen[n] = true",
  "    }",
  "    return dups",
  "}",
  "func main() { fmt.Println(findDuplicates(...)) }",
];

const SWAP_AT = 5.0;
const HOLD_END = 11.5;
const CHAR_DURATION = 0.012;

function createScene(): SceneModule {
  let stage: CinematicStage | null = null;
  let monitorTexture: THREE.CanvasTexture | null = null;
  const stops: (() => void)[] = [];
  let pyBuf: { lines: string[]; visible: number[] } = { lines: [], visible: [] };
  let goBuf: { lines: string[]; visible: number[] } = { lines: [], visible: [] };
  let activeLang: "py" | "go" = "py";
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let typewriterTick = (_dt: number) => {};
  let screenDirty = false;

  function buildRoom(stage: CinematicStage): void {
    const { scene: s } = stage;

    // Floor: dark wood plane
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x0a0807, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    s.add(floor);

    // Back wall
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x05080d, roughness: 0.95 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), wallMat);
    back.position.set(0, 3, -3);
    s.add(back);

    // Subtle volumetric fog so the room feels finite but invisible.
    s.fog = new THREE.FogExp2(0x020306, 0.08);

    // Desk (a single box)
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.06, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x1a120b, roughness: 0.7 }),
    );
    desk.position.set(0, 0.75, -0.4);
    s.add(desk);

    // Monitor: shell + screen plane (separate material so we can make the
    // screen emissive and write to it as a texture).
    const monitorShell = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.0, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0e, roughness: 0.5, metalness: 0.6 }),
    );
    monitorShell.position.set(0, 1.45, -0.45);
    s.add(monitorShell);

    // Canvas-backed screen (we'll draw to it as the typewriter runs).
    canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 640;
    ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    drawEditor(ctx, canvas, pyBuf);
    screenDirty = true;

    const screenTex = new THREE.CanvasTexture(canvas);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    monitorTexture = screenTex;

    const screenMat = new THREE.MeshBasicMaterial({
      map: screenTex,
      toneMapped: false, // emit at full brightness so bloom can pick it up
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.9), screenMat);
    screen.position.set(0, 1.45, -0.41);
    s.add(screen);

    // Engineer silhouette: a flat figure, back to camera, in front of monitor
    const figure = makeFigure();
    figure.position.set(0, 0.9, 0.4);
    s.add(figure);

    // A soft warm point light right at the monitor — its glow on the
    // engineer is the entire mood of this scene.
    const point = new THREE.PointLight(0x88aaff, 6.0, 4.0, 1.5);
    point.position.set(0, 1.45, -0.2);
    s.add(point);

    // Key light: turned down low. This scene lives off the monitor's glow.
    stage.keyLight.intensity = 0.18;
    stage.keyLight.position.set(1, 4, 2);
    stage.rimLight.intensity = 0.4;
    stage.ambient.intensity = 0.05;
  }

  function makeFigure(): THREE.Group {
    // Stylised silhouette: head + shoulders via two cones.
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.2, 24),
      new THREE.MeshBasicMaterial({ color: 0x02030a }),
    );
    body.position.y = 0.5;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x02030a }),
    );
    head.position.y = 1.25;
    group.add(body, head);
    return group;
  }

  function drawEditor(
    c: CanvasRenderingContext2D,
    cv: HTMLCanvasElement,
    buf: { lines: string[]; visible: number[] },
  ): void {
    // Background
    const bg = c.createLinearGradient(0, 0, cv.width, cv.height);
    bg.addColorStop(0, "#04080f");
    bg.addColorStop(0.58, "#071020");
    bg.addColorStop(1, "#050914");
    c.fillStyle = bg;
    c.fillRect(0, 0, cv.width, cv.height);

    // Title bar
    c.fillStyle = "#0a1426";
    c.fillRect(0, 0, cv.width, 56);
    c.fillStyle = "#ff605c";
    c.beginPath();
    c.arc(28, 28, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ffbd44";
    c.beginPath();
    c.arc(56, 28, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#00ca4e";
    c.beginPath();
    c.arc(84, 28, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#7c8caa";
    c.font = "20px monospace";
    c.fillText("~/projects/director — NVIM", 120, 36);

    // Split editor panes. The right pane gives the screen a full-frame image
    // even before the left buffer has typed across the monitor.
    c.fillStyle = "rgba(255,255,255,0.05)";
    c.fillRect(642, 56, 1, cv.height - 56);
    c.fillStyle = "rgba(104,168,255,0.08)";
    c.fillRect(664, 84, 300, 2);
    c.fillStyle = "#6bff95";
    c.font = "18px 'JetBrains Mono', monospace";
    c.fillText("SYSTEM NOTES", 664, 72);
    const notes = [
      ["maintainability", "human-readable first"],
      ["observability", "trace before blame"],
      ["webapi", "calm contract"],
      ["runtime", "python ⇄ go"],
      ["release", "ship when clean"],
    ];
    c.font = "17px 'JetBrains Mono', monospace";
    notes.forEach(([k, v], i) => {
      const yNote = 116 + i * 42;
      c.fillStyle = "rgba(124,140,170,0.78)";
      c.fillText(k.padEnd(16, " "), 664, yNote);
      c.fillStyle = "rgba(230,241,255,0.86)";
      c.fillText(v, 820, yNote);
    });

    c.fillStyle = "rgba(104,168,255,0.13)";
    for (let i = 0; i < 12; i++) {
      c.fillRect(664, 372 + i * 12, 220 + ((i * 37) % 94), 2);
    }

    // Body
    c.font = "22px 'JetBrains Mono', monospace";
    let y = 100;
    const lineH = 28;
    const xLine = 40;
    const xText = 100;
    for (let i = 0; i < buf.lines.length; i++) {
      const fullText = buf.lines[i];
      const shown = buf.visible[i] ?? 0;
      const textSlice = fullText.slice(0, shown);
      if (shown === 0) {
        c.fillStyle = "rgba(90,110,145,0.2)";
        c.fillText(fullText.slice(0, 34), xText, y);
      }
      c.fillStyle = "#3a4a6a";
      c.fillText(String(i + 1).padStart(2, " "), xLine, y);
      c.fillStyle = "#e6f1ff";
      c.fillText(textSlice, xText, y);
      y += lineH;
    }
  }

  function bindTypewriter(): (dt: number) => void {
    return () => {
      if (screenDirty && ctx && canvas) {
        const buf = activeLang === "py" ? pyBuf : goBuf;
        drawEditor(ctx, canvas, buf);
        if (monitorTexture) monitorTexture.needsUpdate = true;
        screenDirty = false;
      }
    };
  }

  const module: SceneModule = {
    config: scene,
    script,

    async preload() {
      await ensureThree();
      if (typeof (document as Document).fonts?.ready !== "undefined") {
        try { await (document as Document).fonts.ready; } catch { /* ignore */ }
      }
    },

    create(rootEl) {
      // Make the scene root fill the cinematic frame.
      rootEl.style.background = "#000";
      const portrait = rootEl.clientHeight > rootEl.clientWidth;
      // Stage is a leaf; we let it size to its host (the .stage-frame).
      stage = new CinematicStage(rootEl, {
        fov: portrait ? 52 : 28,
        bloom: 0.6,
        fog: 0x020306,
        background: 0x000000,
        exposure: 0.95,
      });

      pyBuf = { lines: PY_LINES, visible: PY_LINES.map(() => 0) };
      goBuf = { lines: GO_LINES, visible: GO_LINES.map(() => 0) };
      activeLang = "py";
      buildRoom(stage);

      // Camera: start far, dolly toward monitor.
      stage.camera.position.set(0, 1.55, portrait ? 3.0 : 2.4);
      stage.camera.lookAt(0, 1.45, -0.4);

      // Typewriter tick is wired into the ticker too. Re-renders the screen
      // texture every frame there is new typing progress.
      typewriterTick = bindTypewriter();
      gsap.ticker.add(typewriterTick);

      stage.start();

      // Audio: rain underneath, just barely audible.
      stops.push(startRain(0.28));
      stops.push(startScore("noir", 0.038));
    },

    async warmup() {
      if (!stage) return;
      screenDirty = true;
      typewriterTick(0);
      monitorTexture && (monitorTexture.needsUpdate = true);
      await stage.warmup(5);
    },

    play(tl) {
      if (!stage) return;
      const host = stage.renderer.domElement.parentElement;
      const portrait = Boolean(host && host.clientHeight > host.clientWidth);
      // Dolly camera forward to the monitor over the full scene duration.
      tl.fromTo(
        stage.camera.position,
        { x: 0, y: 1.55, z: portrait ? 3.0 : 2.4 },
        { x: 0, y: 1.5, z: portrait ? 1.85 : 1.1, duration: scene.duration, ease: "power2.inOut" },
        0,
      );

      // Subtle camera roll for handheld feel.
      tl.to(stage.camera.rotation, { z: 0.02, duration: 4, yoyo: true, repeat: 3 }, 0);

      // Python typing: advance each line's "visible" counter over time via
      // a single sweeping tween that controls how many chars are visible.
      let pyCursorTweenDone = false;
      tl.to(
        { i: 0 },
        {
          duration: 0.5,
          onComplete() {
            // Sweep through Python lines sequentially.
            pyBuf.visible = PY_LINES.map(() => 0);
            const total = PY_LINES.reduce((s, l) => s + l.length, 0);
            tl.to(
              pyBuf,
              { duration: total * CHAR_DURATION, ease: "none" } as gsap.TweenVars,
              ">",
            );
            // gsap can't directly tween array values; we use a counter:
            tl.to(
              { n: 0 },
              {
                duration: total * CHAR_DURATION,
                ease: "none",
                onUpdate(this: { progress: () => number }) {
                  const p = this.progress();
                  const charsShown = Math.floor(p * total);
                  pyBuf.visible = lineByCharCount(PY_LINES, charsShown);
                  screenDirty = true;
                },
              } as gsap.TweenVars,
              "<",
            );
          },
        } as gsap.TweenVars,
        0.5,
      );

      // Cross-fade monitor: wash the screen with a flash overlay; we don't
      // need to swap CanvasTexture — we just re-aim the typewriter at Go and
      // repaint.
      // SWAP_AT callback — switch active language buffer.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tlc: any = tl;
      tlc.call(() => {
        activeLang = "go";
        goBuf.visible = GO_LINES.map(() => 0);
        screenDirty = true;
        bigImpact();
      }, [], SWAP_AT);

      // Final chord glow before fade-out.
      tlc.call(() => chordGlow(), [], Math.max(0.5, scene.duration - 1.2));

      tl.to(
        { n: 0 },
        {
          duration: GO_LINES.reduce((s, l) => s + l.length, 0) * CHAR_DURATION,
          ease: "none",
          onUpdate(this: { progress: () => number }) {
            const p = this.progress();
            const total = GO_LINES.reduce((s, l) => s + l.length, 0);
            goBuf.visible = lineByCharCount(GO_LINES, Math.floor(p * total));
            screenDirty = true;
          },
        } as gsap.TweenVars,
        SWAP_AT + 0.4,
      );

      // Hold on final frame.
      tl.to({} as object, { duration: Math.max(0.1, scene.duration - HOLD_END) }, HOLD_END);

      // Suppress unused warning on pyCursorTweenDone; the flag is kept for clarity.
      void pyCursorTweenDone;
    },

    pause() {
      // Ticker is shared with director; nothing local to pause here.
    },

    destroy() {
      while (stops.length) stops.pop()!();
      if (stage) {
        gsap.ticker.remove(typewriterTick);
        stage.dispose();
        stage = null;
      }
      monitorTexture?.dispose();
      monitorTexture = null;
      ctx = null;
      canvas = null;
    },
  };

  return module;
}

/** Build a per-line "chars visible" array given a global char budget. */
function lineByCharCount(lines: string[], chars: number): number[] {
  const out: number[] = [];
  let remaining = chars;
  for (const line of lines) {
    const take = Math.min(line.length, Math.max(0, remaining));
    out.push(take);
    remaining -= take;
  }
  return out;
}

export default createScene();
