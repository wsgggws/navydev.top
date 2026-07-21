import type { SceneEntry, SceneModule } from "./types/scene";
import { warmupCinematicPipeline } from "./lib/three/CinematicStage";

let activePrewarm: Promise<void> | null = null;

export function prewarmReel(reel: SceneEntry[]): Promise<void> {
  if (activePrewarm) return activePrewarm;

  activePrewarm = Promise.allSettled([warmupCinematicPipeline(), ...reel.map((entry) => entry.load())])
    .then(async (loaded) => {
      const scenes = loaded
        .slice(1)
        .filter((result): result is PromiseFulfilledResult<SceneModule> => result.status === "fulfilled")
        .map((result) => result.value);

      await Promise.allSettled(scenes.map((scene) => scene.preload()));
    })
    .then(() => undefined);

  return activePrewarm;
}
