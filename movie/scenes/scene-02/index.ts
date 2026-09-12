import * as THREE from "three";
import type { SceneModule } from "@movie/types/scene";
import { CinematicStage, ensureThree } from "@movie/lib/three/CinematicStage";
import { typingClick } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

/**
 * 第一幕：用一台真实的 CRT 完成人物开场。
 *
 * A real CRT in a dark room. The screen face is a CanvasTexture that we
 * repaint as the typewriter runs. A custom shader pass laid over the
 * screen simulates phosphor mask + scanlines + soft glow. Bloom pulls the
 * bright pixels into a halo. Camera dollies slowly from medium shot to
 * close-up on the screen.
 */

const TYPE_SPEED = 0.038;

const LINE_TIMINGS: { at: number; text: string; prompt?: string }[] = [
  { at: 0.25, prompt: "$", text: " whoami" },
  { at: 1.15, text: "software engineer / lifelong learner" },
  { at: 2.2, prompt: "$", text: " cat principles.md" },
  { at: 3.25, text: "复杂留给系统，清楚留给人" },
  { at: 4.55, prompt: "$", text: " ls interests/" },
  { at: 5.55, text: "systems  tools  history  running  observation  curiosity" },
  { at: 7.1, prompt: "$", text: " status --life" },
  { at: 8.1, text: "still learning, still shipping _" },
];

const SCREEN_W = 1024;
const SCREEN_H = 640;

function createScene(): SceneModule {
  let stage: CinematicStage | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let texture: THREE.CanvasTexture | null = null;
  let lines: LineBuf[] = [];
  const stops: (() => void)[] = [];

  function buildCrt(): THREE.Group {
    const g = new THREE.Group();

    // Housing: rounded box. Without a rounded-box helper we approximate
    // with a beveled shape made from a BoxGeometry wider than the screen,
    // then layer a slightly recessed screen.
    const housingMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.6,
      metalness: 0.4,
    });
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 1.2, 1.0),
      housingMat,
    );
    housing.position.set(0, 0.55, -0.55);
    g.add(housing);

    // Neck / stand
    const neck = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.4, 0.25),
      housingMat,
    );
    neck.position.set(0, -0.05, -0.55);
    g.add(neck);

    // Base
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.7,
    });
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.05, 0.55),
      baseMat,
    );
    base.position.set(0, -0.32, -0.55);
    g.add(base);

    return g;
  }

  function buildScreen(): THREE.Mesh {
    canvas = document.createElement("canvas");
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D ctx");
    paintTerminal(ctx, canvas, lines);

    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const screenMat = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false, // let bloom kiss the bright chars
    });
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.45, 0.9),
      screenMat,
    );
    screen.position.set(0, 0.55, -0.04); // just in front of housing face
    return screen;
  }

  function buildScanlineOverlay(): THREE.Mesh {
    // Custom shader pass that overlays scanlines + RGB mask + subtle vignette.
    const scan = /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const frag = /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D map;
      void main() {
        vec4 c = texture2D(map, vUv);
        // RGB phosphor mask — shift R/B slightly with horizontal sub-pixels.
        float px = vUv.x * 1024.0;
        float sub = mod(px, 3.0);
        vec3 mask;
        if (sub < 1.0)      mask = vec3(1.25, 0.85, 0.85);
        else if (sub < 2.0) mask = vec3(0.85, 1.25, 0.85);
        else                mask = vec3(0.85, 0.85, 1.25);
        c.rgb *= mask;
        // Scanlines: darken at every other row.
        float row = floor(vUv.y * 480.0);
        float scan = mod(row, 2.0) < 0.5 ? 0.78 : 1.0;
        c.rgb *= scan;
        // Slight curvature / vignette tint
        vec2 d = vUv - 0.5;
        float vign = 1.0 - dot(d, d) * 0.6;
        c.rgb *= clamp(vign, 0.55, 1.0);
        gl_FragColor = c;
      }
    `;
    const mat = new THREE.ShaderMaterial({
      vertexShader: scan,
      fragmentShader: frag,
      uniforms: {
        map: { value: texture },
      },
      transparent: false,
    });
    const overlay = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.9), mat);
    overlay.position.set(0, 0.55, -0.035); // a hair in front of screen plane
    return overlay;
  }

  function paintTerminal(
    c: CanvasRenderingContext2D,
    cv: HTMLCanvasElement,
    buf: LineBuf[],
  ): void {
    c.fillStyle = "#000";
    c.fillRect(0, 0, cv.width, cv.height);

    c.font = "26px 'VT323', monospace";
    let y = 40;
    const lineH = 34;
    for (const line of buf) {
      if (!line.visible) continue;
      const slice = line.full.slice(0, line.shown);
      if (line.prompt) {
        c.fillStyle = "#88ff88";
        c.fillText(line.prompt + " ", 30, y);
        c.fillStyle = "#6cff8a";
        c.fillText(slice, 60, y);
      } else {
        c.fillStyle = "#8eff8a";
        c.fillText(slice, 30, y);
      }
      y += lineH;
      if (y > cv.height - 30) break;
    }
  }

  interface LineBuf {
    full: string;
    shown: number;
    prompt?: string;
    visible: boolean;
    _cadence?: number;
  }

  const module: SceneModule = {
    config: scene,
    script,

    async preload() {
      await ensureThree();
    },

    create(rootEl) {
      rootEl.style.background = "#000";
      const portrait = rootEl.clientHeight > rootEl.clientWidth;
      rootEl.insertAdjacentHTML(
        "beforeend",
        `
          <div class="terminal-story">
            <div class="terminal-story__label">PORTRAIT</div>
            <div class="terminal-story__headline">写代码，也写自己的生活</div>
            <div class="terminal-story__grid">
              <span>系统</span>
              <span>工具</span>
              <span>故事</span>
            </div>
          </div>
          <div class="terminal-ledger">
            <span><b>BUILD SYSTEMS</b><em>让复杂有秩序</em></span>
            <span><b>SHAPE TOOLS</b><em>让重复变简单</em></span>
            <span><b>TRACE PROBLEMS</b><em>让错误有答案</em></span>
            <span><b>TELL STORIES</b><em>让技术有人味</em></span>
          </div>
        `,
      );
      stage = new CinematicStage(rootEl, {
        fov: portrait ? 68 : 30,
        bloom: 0.55,
        background: 0x000000,
        exposure: 1.0,
      });

      // Initialise before the CanvasTexture is created so the first paint has rows.
      lines = LINE_TIMINGS.map((l) => ({
        full: l.text,
        shown: 0,
        prompt: l.prompt,
        visible: false,
      }));

      const crt = buildCrt();
      const screen = buildScreen();
      const overlay = buildScanlineOverlay();
      stage.scene.add(crt, screen, overlay);

      // Tilt the whole CRT slightly down so the camera doesn't look flat.
      const crtGroup = new THREE.Group();
      crtGroup.add(crt, screen, overlay);
      crtGroup.rotation.x = -0.04;
      stage.scene.add(crtGroup);

      // Camera: starts a bit further away.
      stage.camera.position.set(0, 0.55, portrait ? 2.9 : 2.5);
      stage.camera.lookAt(0, 0.55, 0);

      // Lighting — almost none. The screen + a sliver of rim on the housing.
      stage.keyLight.intensity = 0.1;
      stage.rimLight.intensity = 0.4;
      stage.rimLight.color.set(0x88aaff);
      stage.ambient.intensity = 0.05;

      stage.start();

    },

    async warmup() {
      if (!stage) return;
      if (ctx && canvas) paintTerminal(ctx, canvas, lines);
      if (texture) texture.needsUpdate = true;
      await stage.warmup(5);
    },

    play(tl) {
      if (!stage) return;
      const camera = stage.camera;
      const host = stage.renderer.domElement.parentElement;
      const portrait = Boolean(host && host.clientHeight > host.clientWidth);
      const story = host?.querySelector(".terminal-story") as HTMLElement | null;
      const ledgerItems = Array.from(
        host?.querySelectorAll(".terminal-ledger span") ?? [],
      ) as HTMLElement[];

      // Dolly camera from medium → close-up on screen.
      tl.fromTo(
        camera.position,
        { x: 0, y: 0.55, z: portrait ? 2.9 : 2.5 },
        { x: 0, y: 0.55, z: portrait ? 2.05 : 1.05, duration: scene.duration, ease: "power1.inOut" },
        0,
      );
      // Slight breathing on camera Y.
      tl.fromTo(camera, { fov: portrait ? 68 : 30 }, { fov: portrait ? 64 : 32, duration: scene.duration }, 0);
      if (story) {
        tl.fromTo(story, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8 }, 2.2);
        tl.to(story, { opacity: 0.92, duration: 0.8 }, 5.4);
      }
      ledgerItems.forEach((item, i) => {
        const at = 3.3 + i * 1.1;
        tl.fromTo(
          item,
          { opacity: 0, x: 18 },
          { opacity: 1, x: 0, duration: 0.45, ease: "power2.out" },
          at,
        );
        tl.call(() => item.classList.add("is-active"), [], at + 0.45);
      });

      // Typewriter per line: pre-register every tween so first playback and replay
      // follow the same deterministic timeline.
      LINE_TIMINGS.forEach((entry, i) => {
        const buf = lines[i];
        const cursor = { shown: 0 };
        const duration = Math.max(0.12, entry.text.length * TYPE_SPEED);

        tl.call(() => {
          cursor.shown = 0;
          buf.shown = 0;
          buf.visible = true;
          buf._cadence = 0;
          if (ctx && canvas) paintTerminal(ctx, canvas, lines);
          if (texture) texture.needsUpdate = true;
        }, [], entry.at);

        tl.to(
          cursor,
          {
            shown: entry.text.length,
            duration,
            ease: "none",
            onUpdate() {
              const shown = Math.floor(cursor.shown);
              buf.shown = shown;
              const cadence = Math.floor(shown / 3);
              const prev = buf._cadence ?? 0;
              if (cadence !== prev) {
                buf._cadence = cadence;
                typingClick();
              }
              if (ctx && canvas) paintTerminal(ctx, canvas, lines);
              if (texture) texture.needsUpdate = true;
            },
            onComplete() {
              buf.shown = entry.text.length;
              if (ctx && canvas) paintTerminal(ctx, canvas, lines);
              if (texture) texture.needsUpdate = true;
            },
          },
          entry.at,
        );
      });

      // Hold on the last typed line.
      tl.to({} as object, { duration: Math.max(0.3, scene.duration - 8.8) }, 8.8);
    },

    pause() {},

    destroy() {
      while (stops.length) stops.pop()!();
      if (stage) {
        stage.dispose();
        stage = null;
      }
      texture?.dispose();
      texture = null;
      canvas = null;
      ctx = null;
    },
  };

  return module;
}

export default createScene();
