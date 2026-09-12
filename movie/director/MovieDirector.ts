import type gsap from "gsap";
import { Timeline } from "./Timeline";
import { Camera } from "./Camera";
import type { SceneEntry, SceneConfig, SceneModule } from "../types/scene";

const SCENE_PLAYBACK_RATE = 1;
const REEL_TEMPO_MULTIPLIER = 1;

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

export interface MovieDirectorError {
  index: number;
  config: SceneConfig | null;
  error: unknown;
  requiresReload: boolean;
}

function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|module script|module fetch/i.test(message);
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
  private preloadingScenes = new Map<number, Promise<void>>();
  private preloadedScenes = new Set<number>();
  private onState: ((state: MovieDirectorState) => void) | null = null;
  private onProgress: ((progress: MovieDirectorProgress) => void) | null = null;
  private onError: ((failure: MovieDirectorError) => void) | null = null;
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

  setOnError(cb: (failure: MovieDirectorError) => void): void {
    this.onError = cb;
  }

  /**
   * Begin playback from the first scene. Preloads scene 0 and 1 in parallel.
   */
  async start(): Promise<void> {
    if (this.scenes.length === 0) return;
    this.disposed = false;
    try {
      await this.preloadScene(0);
      if (this.scenes[1]) void this.preloadScene(1).catch(() => undefined);
      await this.enterScene(0);
    } catch (error) {
      this.emitError(0, error);
    }
  }

  play(): void {
    this.timeline.play();
  }

  pause(): void {
    this.timeline.pause();
    this.currentScene?.pause();
  }

  skip(): void {
    if (this.transitioning || !this.currentScene || this.index >= this.scenes.length - 1) return;
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

  retry(index: number): void {
    if (this.transitioning || this.disposed || index < 0 || index >= this.scenes.length) return;
    this.timeline.pause();
    void this.transitionTo(index, "fade");
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.currentScene?.destroy();
    this.currentScene = null;
    this.timeline.kill();
    this.stage.innerHTML = "";
  }

  // ---- internals ----

  private async preloadScene(i: number): Promise<void> {
    if (this.preloadedScenes.has(i)) return;
    const pending = this.preloadingScenes.get(i);
    if (pending) return pending;

    const preload = (async () => {
      const scene = await this.loadScene(i);
      if (!scene) return;
      await scene.preload();
      this.preloadedScenes.add(i);
    })().finally(() => {
      this.preloadingScenes.delete(i);
    });
    this.preloadingScenes.set(i, preload);
    return preload;
  }

  private async enterScene(i: number): Promise<void> {
    if (this.disposed) return;
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
    gt.timeScale(
      (next.config.playbackRate ?? SCENE_PLAYBACK_RATE) * REEL_TEMPO_MULTIPLIER,
    );
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

    // The final scene holds on its last frame. There is no automatic loop.
    if (i < this.scenes.length - 1) {
      gt.call(() => {
        void this.advance();
      });
    }

    // Kick playback now that everything is on stage.
    this.timeline.play();

    // Preload the next scene while this one plays.
    const after = this.scenes[i + 1];
    if (after) {
      void this.preloadScene(i + 1).catch(() => undefined);
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

  private emitError(index: number, error: unknown): void {
    this.onError?.({
      index,
      config: this.scenes[index]?.config ?? null,
      error,
      requiresReload: isModuleLoadError(error),
    });
  }

  private async waitForWarmFrames(): Promise<void> {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  private async advance(): Promise<void> {
    const cur = this.currentScene;
    if (!cur || this.index >= this.scenes.length - 1) return;

    await this.transitionTo(this.index + 1, cur.config.transition);
  }

  private async transitionTo(targetIndex: number, kind: SceneConfig["transition"]): Promise<void> {
    if (
      this.transitioning ||
      this.disposed ||
      targetIndex < 0 ||
      targetIndex >= this.scenes.length
    ) return;
    this.transitioning = true;
    const cur = this.currentScene;

    try {
      // Keep the current frame visible while a jumped-to scene downloads.
      // Closing the matte first turns ordinary network latency into a black
      // screen, especially when the visitor skips several chapters ahead.
      if (targetIndex >= 0 && targetIndex < this.scenes.length) {
        await this.preloadScene(targetIndex);
      }

      await this.runTransition(kind, async () => {
        if (!cur) {
          await this.enterScene(targetIndex);
          return;
        }

        // Tear down and mount while the matte is closed, like a real scene splice.
        cur.destroy();

        await this.enterScene(targetIndex);
      });
    } catch (error) {
      console.error(`Unable to enter scene ${targetIndex + 1}`, error);
      this.emitError(targetIndex, error);
    } finally {
      this.transitioning = false;
    }
  }

  private async runTransition(
    kind: SceneConfig["transition"],
    duringBlack: () => Promise<void>,
  ): Promise<void> {
    const transitionMs = this.reducedMotion ? 140 : 520;
    const classKind = this.reducedMotion && kind !== "cut" ? "fade" : kind;

    if (!this.currentScene || kind === "cut") {
      await duringBlack();
      return;
    }

    const overlay = document.createElement("div");
    await new Promise<void>((resolve) => {
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

    try {
      await duringBlack();
    } finally {
      await new Promise<void>((resolve) => {
        window.setTimeout(() => {
          overlay.classList.remove("scene-transition--active");
          window.setTimeout(() => {
            overlay.remove();
            resolve();
          }, transitionMs);
        }, 60);
      });
    }
  }

}

// Re-export the gsap type so scenes can `import type { gsap } from "@movie/director"` if desired.
export type { gsap };
