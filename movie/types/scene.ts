/**
 * Scene contract.
 *
 * Every Scene is a plugin. Scenes never reference each other.
 * Only the Director controls playback.
 *
 * Source of truth for the data shape: movie/scenes/<id>/config.ts
 * Source of truth for the behavior: movie/scenes/<id>/index.ts
 */

export type TransitionKind = "fade" | "cut" | "wipe" | "zoom" | "glitch" | "iris" | "match-cut";
export type SceneMood = "isolation" | "signal" | "rush" | "contrast" | "play" | "release";
export type ScenePacing = "slow-burn" | "pulse" | "staccato" | "hold" | "crescendo";
export type SceneShot = "establishing" | "medium" | "closeup" | "macro" | "overhead" | "split";
export type SceneColorGrade =
  | "monitor-blue"
  | "noir-green"
  | "neon-pink"
  | "toxic-red"
  | "warm-garden"
  | "launch-amber";
export type SceneSoundMotif = "bed" | "rhythm" | "accent" | "silence";
export type TitleCardStyle = "chapter-card" | "cold-open" | "burn-in" | "terminal-caption" | "silent-card";

export interface SceneConfig {
  /** Stable identifier. Must match folder name. */
  id: string;
  /** Human-readable title shown briefly during transition. */
  title: string;
  /** A short subtitle or line of intent shown by cinematic overlays. */
  caption?: string;
  /** Emotional role of the scene. Used by overlays, grades, and sound direction. */
  mood: SceneMood;
  /** Narrative rhythm. Not a duration replacement; it tells the Director how the scene should breathe. */
  pacing: ScenePacing;
  /** Primary shot language for the scene. */
  shot: SceneShot;
  /** Shared color grade token for scene-level and overlay-level consistency. */
  colorGrade: SceneColorGrade;
  /** Dominant sound design role for this scene. */
  soundMotif: SceneSoundMotif;
  /** Optional title-card treatment. Defaults to chapter-card. */
  titleCard?: TitleCardStyle;
  /** Target length in seconds. Director uses this for timeline scheduling. */
  duration: number;
  /** Optional scene-local playback multiplier. Defaults to Director global rate. */
  playbackRate?: number;
  /** How this scene hands off to the next. */
  transition: TransitionKind;
  /** Asset URLs the Director preloads before create(). */
  preload: string[];
}

/**
 * The contract every scene plugin must satisfy.
 *
 * preload  — fetch any heavy assets (models, fonts, audio). Called early.
 * create   — mount DOM/Three/whatever into the provided root. No motion yet.
 * play     — attach scene-local animations to the shared timeline. Called once per scene life.
 * pause    — pause timeline-driven motion. Idempotent.
 * destroy  — unmount, release GPU/audio/canvas refs. Must be safe to call repeatedly.
 *
 * The timeline type is left loose on purpose: scenes import gsap directly
 * and let TypeScript narrow methods at the call site. The Director hands
 * scenes a gsap.core.Timeline at runtime; this matches by structural usage.
 */
export interface SceneModule {
  config: SceneConfig;
  /** Markdown script of the scene — useful for accessibility, captions, AI context. */
  script: string;

  preload(): Promise<void>;
  create(root: HTMLElement): void;
  /** Optional post-create warmup before the Director starts the story timeline. */
  warmup?(): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  play(timeline: any): void;
  pause(): void;
  destroy(): void;
}

/** Public shape of a scene registry entry — what `movie/movie.ts` exports. */
export interface SceneEntry {
  /** Lightweight metadata available before the scene implementation loads. */
  config: SceneConfig;
  /** Dynamically import and return the scene plugin implementation. */
  load(): Promise<SceneModule>;
}
