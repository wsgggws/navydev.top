/**
 * Cinematic stage — lazily pulls three.js + postprocessing on first use.
 *
 * The static `import * as THREE` shape would force Vite to bundle the
 * entire ~600 KB Three.js module up front. Instead, we use dynamic
 * imports so Vite code-splits `three` into its own chunk that loads
 * only when a 3D scene actually mounts.
 */

import { gsap } from "gsap";
import type * as THREE_NS from "three";

// Cached handles, populated on first `ensureThree()`.
let THREE: typeof THREE_NS | undefined;
let EffectComposer: any;
let RenderPass: any;
let UnrealBloomPass: any;

const TICKER_FRAMES = new WeakSet<CinematicStage>();

/** Called by 3D scenes in their `preload()` step. Idempotent. */
export async function ensureThree(): Promise<void> {
  if (THREE) return;
  // Parallel dynamic imports — Vite will dedupe.
  const [three, composer, renderPass, bloom] = await Promise.all([
    import("three"),
    import("three/examples/jsm/postprocessing/EffectComposer.js"),
    import("three/examples/jsm/postprocessing/RenderPass.js"),
    import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
  ]);
  THREE = three;
  EffectComposer = composer.EffectComposer;
  RenderPass = renderPass.RenderPass;
  UnrealBloomPass = bloom.UnrealBloomPass;
}

export interface CinematicStageOptions {
  fov?: number;
  aspect?: number;
  bloom?: number;
  fog?: number;
  background?: number;
  exposure?: number;
  pixelRatio?: number;
}

export class CinematicStage {
  public readonly renderer: any;
  public readonly scene: any;
  public readonly camera: any;
  public readonly composer: any;

  public readonly keyLight: any;
  public readonly rimLight: any;
  public readonly ambient: any;

  private host: HTMLElement;
  private bloom: any | null = null;
  private resize: ResizeObserver;
  private started = false;

  constructor(host: HTMLElement, opts: CinematicStageOptions = {}) {
    if (!THREE) {
      throw new Error("CinematicStage: ensureThree() must be awaited in preload() first");
    }
    this.host = host;

    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;
    const aspect = opts.aspect ?? width / height;

    this.scene = new THREE.Scene();
    if (opts.background !== undefined) {
      this.scene.background = new THREE.Color(opts.background);
    }
    if (opts.fog !== undefined && opts.fog !== 0) {
      this.scene.fog = new THREE.FogExp2(opts.fog, 0.04);
    }

    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 32, aspect, 0.1, 200);
    this.camera.position.set(0, 1.4, 6);
    this.camera.lookAt(0, 0.8, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: window.devicePixelRatio < 2,
      alpha: false,
      powerPreference: "high-performance",
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.pixelRatio ?? 1.5));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = opts.exposure ?? 1.0;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.inset = "0";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";

    // 3-point lighting rig
    this.ambient = new THREE.AmbientLight(0x223344, 0.6);
    this.scene.add(this.ambient);

    this.keyLight = new THREE.DirectionalLight(0xffe4b2, 1.4);
    this.keyLight.position.set(2, 4, 3);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x6ea8ff, 0.9);
    this.rimLight.position.set(-3, 2, -2);
    this.scene.add(this.rimLight);

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.setSize(width, height);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (opts.bloom && opts.bloom > 0) {
      this.bloom = new UnrealBloomPass(
        new (THREE as any).Vector2(width, height),
        opts.bloom,
        0.85,
        0.3,
      );
      this.composer.addPass(this.bloom);
    }

    this.resize = new ResizeObserver(() => this.applySize());
    this.resize.observe(host);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    if (!TICKER_FRAMES.has(this)) {
      gsap.ticker.add(this.renderTick);
      TICKER_FRAMES.add(this);
    }
  }

  async warmup(frames = 4): Promise<void> {
    const renderer = this.renderer as {
      compile?: (scene: any, camera: any) => void;
      compileAsync?: (scene: any, camera: any) => Promise<void>;
    };

    if (renderer.compileAsync) {
      try {
        await renderer.compileAsync(this.scene, this.camera);
      } catch {
        renderer.compile?.(this.scene, this.camera);
      }
    } else {
      renderer.compile?.(this.scene, this.camera);
    }

    this.applySize();
    for (let i = 0; i < frames; i++) {
      this.camera.updateMatrixWorld();
      this.composer.render();
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
  }

  stop(): void {
    this.started = false;
    if (TICKER_FRAMES.has(this)) {
      gsap.ticker.remove(this.renderTick);
      TICKER_FRAMES.delete(this);
    }
  }

  dispose(): void {
    this.stop();
    this.resize.disconnect();
    this.scene.traverse((obj: any) => {
      const mesh = obj;
      if (mesh.geometry) mesh.geometry.dispose?.();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose?.());
      else mat?.dispose?.();
    });
    this.composer.dispose?.();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private renderTick = () => {
    if (!this.started) return;
    this.camera.updateMatrixWorld();
    this.composer.render();
  };

  private applySize(): void {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}

/** True if Three.js bundle has already been loaded. */
export function threeReady(): boolean {
  return !!THREE;
}

let pipelineWarmup: Promise<void> | null = null;

export function warmupCinematicPipeline(): Promise<void> {
  if (pipelineWarmup) return pipelineWarmup;

  pipelineWarmup = (async () => {
    await ensureThree();
    if (!THREE) return;

    const host = document.createElement("div");
    host.style.cssText = `
      position: fixed;
      left: -16px;
      top: -16px;
      width: 8px;
      height: 8px;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
    `;
    document.body.appendChild(host);

    const stage = new CinematicStage(host, {
      fov: 38,
      bloom: 0.5,
      background: 0x000000,
      exposure: 1,
      pixelRatio: 1,
    });

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshStandardMaterial({
        color: 0x88aaff,
        emissive: 0x2244ff,
        emissiveIntensity: 0.4,
      }),
    );
    stage.scene.add(mesh);
    stage.camera.position.set(0, 0, 2);
    stage.camera.lookAt(0, 0, 0);

    try {
      await stage.warmup(4);
    } finally {
      stage.dispose();
      host.remove();
    }
  })();

  return pipelineWarmup;
}
