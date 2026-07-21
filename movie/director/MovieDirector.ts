import type gsap from "gsap";
import { Timeline } from "./Timeline";
import { Camera } from "./Camera";
import type { SceneEntry, SceneConfig, SceneModule } from "../types/scene";

const SCENE_PLAYBACK_RATE = 1;
const REEL_RESTART_DELAY_MS = 3200;

export interface MovieDirectorOptions {
  reducedMotion?: boolean;
}

export interface MovieDirectorState {
  index: number;
  total: number;
  config: SceneConfig;
}

export interface MovieDirectorProgress extends MovieDirectorState {
  progress: number;
}

/**
 * MovieDirector owns playback.
 *
 * Responsibilities:
 *   - Hold the ordered scene list.
 *   - Preload the next scene while current plays (perf budget per CLAUDE.md).
 *   - Mount, play, pause, destroy scenes.
 *   - Run transitions between scenes.
 *
 * Non-responsibilities:
 *   - Knowing what is inside a scene.
 *   - Knowing how a scene renders.
 */
export class MovieDirector {
  private scenes: SceneEntry[];
  private stage: HTMLElement;
  private sceneLayer: HTMLElement;
  private transitionLayer: HTMLElement;
  private timeline: Timeline;
  private camera: Camera;
  private index = 0;
  private currentScene: SceneModule | null = null;
  private loadingScenes = new Map<number, Promise<SceneModule>>();
  private preloadedScenes = new Set<number>();
  private nextScenePromise: Promise<void> | null = null;
  private onState: ((state: MovieDirectorState) => void) | null = null;
  private onProgress: ((progress: MovieDirectorProgress) => void) | null = null;
  private restartTimer: number | null = null;
  private transitioning = false;
  private disposed = false;
  private reducedMotion: boolean;

  constructor(stage: HTMLElement, scenes: SceneEntry[], options: MovieDirectorOptions = {}) {
    this.stage = stage;
    this.scenes = scenes;
    this.reducedMotion = options.reducedMotion ?? false;
    this.stage.innerHTML = "";
    this.sceneLayer = document.createElement("div");
    this.sceneLayer.className = "stage-scenes";
    this.transitionLayer = document.createElement("div");
    this.transitionLayer.className = "stage-overlays";
    this.stage.append(this.sceneLayer, this.transitionLayer);
    this.timeline = new Timeline();
    this.camera = new Camera();
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  get current(): SceneConfig | null {
    return this.currentScene ? this.currentScene.config : null;
  }

  get isPlaying(): boolean {
    return !this.timeline.gsapTimeline.paused();
  }

  setOnState(cb: (state: MovieDirectorState) => void): void {
    this.onState = cb;
  }

  setOnProgress(cb: (progress: MovieDirectorProgress) => void): void {
    this.onProgress = cb;
  }

  /**
   * Begin playback from the first scene. Preloads scene 0 and 1 in parallel.
   */
  async start(): Promise<void> {
    if (this.scenes.length === 0) return;
    this.disposed = false;
    await this.preloadScene(0);
    if (this.scenes[1]) void this.preloadScene(1).catch(() => undefined);
    await this.enterScene(0);
  }

  play(): void {
    this.timeline.play();
  }

  pause(): void {
    this.timeline.pause();
    this.currentScene?.pause();
  }

  skip(): void {
    if (this.transitioning || !this.currentScene) return;
    this.timeline.pause();
    void this.advance();
  }

  replay(): void {
    if (this.transitioning || !this.currentScene) return;
    this.timeline.pause();
    void this.transitionTo(this.index, "fade");
  }

  restart(): void {
    if (this.transitioning) return;
    this.timeline.pause();
    void this.transitionTo(0, "fade");
  }

  goToScene(index: number): void {
    if (this.transitioning || index < 0 || index >= this.scenes.length || index === this.index) return;
    this.timeline.pause();
    void this.transitionTo(index, "fade");
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.restartTimer !== null) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.currentScene?.destroy();
    this.currentScene = null;
    this.timeline.kill();
    this.stage.innerHTML = "";
  }

  // ---- internals ----

  private async preloadScene(i: number): Promise<void> {
    const scene = await this.loadScene(i);
    if (!scene || this.preloadedScenes.has(i)) return;
    await scene.preload();
    this.preloadedScenes.add(i);
  }

  private async enterScene(i: number): Promise<void> {
    if (this.disposed) return;
    if (this.restartTimer !== null) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    await this.preloadScene(i);
    const next = await this.loadScene(i);
    if (!next) {
      // End of reel. Hold on final frame.
      return;
    }

    this.index = i;
    this.currentScene = next;

    // Fresh scene subtree keeps memory bounded without clearing persistent overlays.
    this.sceneLayer.innerHTML = "";
    const root = document.createElement("div");
    root.className = "scene-root";
    root.dataset.sceneId = next.config.id;
    this.sceneLayer.appendChild(root);

    next.create(root);
    this.camera.attach(root);
    if (next.warmup) await next.warmup();
    await this.waitForWarmFrames();
    if (this.disposed || this.currentScene !== next) return;

    this.emitState(next.config, 0);

    // Reset timeline. Each scene declares its own motion.
    this.timeline.clear();
    const gt = this.timeline.gsapTimeline;
    gt.timeScale(next.config.playbackRate ?? SCENE_PLAYBACK_RATE);
    next.play(gt);

    // Pin to scene's declared duration so the timeline never outruns the story.
    const declared = next.config.duration;
    const computed = this.timeline.duration();
    if (computed < declared) {
      gt.to({}, { duration: declared - computed });
    }

    gt.eventCallback("onUpdate", () => {
      this.emitProgress(next.config, declared);
    });

    // Kick the loop: at end of scene, transition, then advance.
    gt.call(() => {
      void this.advance();
    });

    // Kick playback now that everything is on stage.
    this.timeline.play();

    // Preload the next scene while this one plays.
    const after = this.scenes[i + 1];
    if (after && !this.nextScenePromise) {
      this.nextScenePromise = this.preloadScene(i + 1).finally(() => {
        this.nextScenePromise = null;
      });
    }
  }

  private async loadScene(i: number): Promise<SceneModule | null> {
    const entry = this.scenes[i];
    if (!entry) return null;

    const pending = this.loadingScenes.get(i);
    if (pending) return pending;

    const load = entry.load().catch((error) => {
      this.loadingScenes.delete(i);
      throw error;
    });
    this.loadingScenes.set(i, load);
    return load;
  }

  private emitState(config: SceneConfig, progress: number): void {
    const state = { index: this.index, total: this.scenes.length, config };
    this.onState?.(state);
    this.onProgress?.({ ...state, progress });
  }

  private emitProgress(config: SceneConfig, declared: number): void {
    const time = this.timeline.gsapTimeline.time();
    const progress = declared > 0 ? Math.min(1, Math.max(0, time / declared)) : 1;
    this.onProgress?.({ index: this.index, total: this.scenes.length, config, progress });
  }

  private async waitForWarmFrames(): Promise<void> {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  private async advance(): Promise<void> {
    const cur = this.currentScene;
    if (!cur) return;

    await this.transitionTo(this.index + 1, cur.config.transition);
  }

  private async transitionTo(targetIndex: number, kind: SceneConfig["transition"]): Promise<void> {
    if (this.transitioning || this.disposed) return;
    this.transitioning = true;
    const cur = this.currentScene;

    try {
      await this.runTransition(kind, async () => {
        if (!cur) {
          await this.enterScene(targetIndex);
          return;
        }

        // Tear down and mount while the matte is closed, like a real scene splice.
        cur.destroy();

        if (targetIndex >= this.scenes.length) {
          this.currentScene = null;
          this.sceneLayer.innerHTML = "";
          this.scheduleRestart();
          return;
        }

        await this.enterScene(targetIndex);
      });
    } finally {
      this.transitioning = false;
    }
  }

  private async runTransition(
    kind: SceneConfig["transition"],
    duringBlack: () => Promise<void>,
  ): Promise<void> {
    const transitionMs = this.reducedMotion ? 180 : 760;
    const classKind = this.reducedMotion && kind !== "cut" ? "fade" : kind;

    if (!this.currentScene || kind === "cut") {
      await duringBlack();
      return;
    }

    await new Promise<void>((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "scene-transition scene-transition--" + classKind;
      overlay.style.setProperty("--transition-duration", `${transitionMs}ms`);
      this.transitionLayer.appendChild(overlay);
      // Force a reflow so CSS transition kicks in.
      void overlay.offsetWidth;
      overlay.classList.add("scene-transition--active");
      window.setTimeout(() => {
        resolve();
      }, transitionMs);
    });

    await duringBlack();

    await new Promise<void>((resolve) => {
      const overlay = this.transitionLayer.querySelector(".scene-transition");
      if (!(overlay instanceof HTMLElement)) {
        resolve();
        return;
      }
      window.setTimeout(() => {
        overlay.classList.remove("scene-transition--active");
        window.setTimeout(() => {
          overlay.remove();
          resolve();
        }, transitionMs);
      }, 80);
    });
  }

  private scheduleRestart(): void {
    if (this.disposed || this.scenes.length === 0) return;
    if (this.restartTimer !== null) window.clearTimeout(this.restartTimer);
    this.restartTimer = window.setTimeout(() => {
      this.restartTimer = null;
      if (this.disposed) return;
      void this.enterScene(0);
    }, REEL_RESTART_DELAY_MS);
  }
}

// Re-export the gsap type so scenes can `import type { gsap } from "@movie/director"` if desired.
export type { gsap };
