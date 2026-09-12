import type { SceneEntry } from "./types/scene";
import { scene as method } from "./scenes/scene-01/config";
import { scene as portrait } from "./scenes/scene-02/config";
import { scene as curiosity } from "./scenes/scene-05/config";
import { scene as finale } from "./scenes/scene-06/config";
import { scene as systems } from "./scenes/scene-08/config";
import { scene as offscreen } from "./scenes/scene-09/config";
import { scene as workflow } from "./scenes/scene-11/config";

// To add a new scene, append one line here. Nothing else changes.
const reel: SceneEntry[] = [
  {
    config: portrait,
    load: async () => (await import("./scenes/scene-02")).default,
  },
  {
    config: method,
    load: async () => (await import("./scenes/scene-01")).default,
  },
  {
    config: systems,
    load: async () => (await import("./scenes/scene-08")).default,
  },
  {
    config: workflow,
    load: async () => (await import("./scenes/scene-11")).default,
  },
  {
    config: offscreen,
    load: async () => (await import("./scenes/scene-09")).default,
  },
  {
    config: curiosity,
    load: async () => (await import("./scenes/scene-05")).default,
  },
  {
    config: finale,
    load: async () => (await import("./scenes/scene-06")).default,
  },
];

export default reel;
