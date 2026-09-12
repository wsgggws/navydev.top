/**
 * Cinematic stage — lazily pulls three.js + postprocessing on first use.
 *
 * The static `import * as THREE` shape would force Vite to bundle the
 * entire ~600 KB Three.js module up front. Instead, we use dynamic
 * imports so Vite code-splits `three` into its own chunk that loads
 * only when a 3D scene actually mounts.
 */

import { gsap } from "gsap";
import type * as THREE_NS from "./runtime";
import {
  getRenderingProfile,
  subscribeRenderingQuality,
  type RenderingProfile,
} from "./quality";

// Cached handles, populated on first `ensureThree()`.
let THREE: typeof THREE_NS | undefined;
let threeLoading: Promise<void> | null = null;
let EffectComposer: any;
let RenderPass: any;
let UnrealBloomPass: any;

const TICKER_FRAMES = new WeakSet<CinematicStage>();

/** Called by 3D scenes in their `preload()` step. Idempotent. */
export async function ensureThree(): Promise<void> {
  if (THREE) return;
  if (!threeLoading) {
    threeLoading = Promise.all([
      // The adapter exposes only APIs used by this stage. Importing the full
      // namespace here would make Rollup retain every Three.js export.
      import("./runtime"),
      import("three/examples/jsm/postprocessing/EffectComposer.js"),
      import("three/examples/jsm/postprocessing/RenderPass.js"),
      import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
    ])
      .then(([three, composer, renderPass, bloom]) => {
        THREE = three;
        EffectComposer = composer.EffectComposer;
        RenderPass = renderPass.RenderPass;
        UnrealBloomPass = bloom.UnrealBloomPass;
      })
      .catch((error) => {
        threeLoading = null;
        throw error;
      });
  }
  await threeLoading;
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
  private configuredBloom = 0;
  private qualityUnsubscribe: (() => void) | null = null;
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
    const profile = getRenderingProfile();
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, opts.pixelRatio ?? profile.pixelRatioCap),
    );
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

    this.configuredBloom = opts.bloom ?? 0;
    if (this.configuredBloom > 0 && profile.bloomScale > 0) {
      this.bloom = new UnrealBloomPass(
        new (THREE as any).Vector2(width, height),
        this.configuredBloom * profile.bloomScale,
        0.85,
        0.3,
      );
      this.composer.addPass(this.bloom);
    }

    this.resize = new ResizeObserver(() => this.applySize());
    this.resize.observe(host);
    this.qualityUnsubscribe = subscribeRenderingQuality((_quality, nextProfile) => {
      this.applyQuality(nextProfile);
    });
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
    this.qualityUnsubscribe?.();
    this.qualityUnsubscribe = null;
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
    if (!this.started || document.hidden) return;
    this.camera.updateMatrixWorld();
    this.composer.render();
  };

  private applyQuality(profile: RenderingProfile): void {
    if (!THREE) return;
    const pixelRatio = Math.min(window.devicePixelRatio, profile.pixelRatioCap);
    this.renderer.setPixelRatio(pixelRatio);
    this.composer.setPixelRatio(pixelRatio);

    if (this.configuredBloom > 0 && profile.bloomScale > 0) {
      if (!this.bloom) {
        this.bloom = new UnrealBloomPass(
          new (THREE as any).Vector2(this.host.clientWidth, this.host.clientHeight),
          this.configuredBloom * profile.bloomScale,
          0.85,
          0.3,
        );
        this.composer.addPass(this.bloom);
      } else {
        this.bloom.strength = this.configuredBloom * profile.bloomScale;
      }
    } else if (this.bloom) {
      this.composer.removePass(this.bloom);
      this.bloom.dispose?.();
      this.bloom = null;
    }

    this.applySize();
  }

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
