import type { SceneEntry } from "./types/scene";
import { warmupCinematicPipeline } from "./lib/three/CinematicStage";

let activePrewarm: Promise<void> | null = null;
const OPENING_SCENE_COUNT = 2;

async function preloadEntry(entry: SceneEntry): Promise<void> {
  const scene = await entry.load();
  await scene.preload();
}

export function prewarmReel(reel: SceneEntry[]): Promise<void> {
  if (activePrewarm) return activePrewarm;

  // Only put the opening and its hand-off on the critical path. The Director
  // keeps preloading one scene ahead during playback, so downloading the full
  // reel here only creates request and parse contention on slower devices.
  activePrewarm = Promise.allSettled([
    warmupCinematicPipeline(),
    ...reel.slice(0, OPENING_SCENE_COUNT).map(preloadEntry),
  ])
    .then(() => undefined);

  return activePrewarm;
}
