import type { SceneEntry } from "./types/scene";
import { scene as start } from "./actions/start/config";
import { scene as portrait } from "./scenes/scene-01/config";
import { scene as method } from "./scenes/scene-02/config";
import { scene as systems } from "./scenes/scene-03/config";
import { scene as workflow } from "./scenes/scene-04/config";
import { scene as offscreen } from "./scenes/scene-05/config";
import { scene as curiosity } from "./scenes/scene-06/config";
import { scene as creation } from "./scenes/scene-07/config";
import { scene as continuation } from "./actions/continue/config";

const reel: SceneEntry[] = [
  {
    config: start,
    load: async () => (await import("./actions/start")).default,
  },
  {
    config: portrait,
    load: async () => (await import("./scenes/scene-01")).default,
  },
  {
    config: method,
    load: async () => (await import("./scenes/scene-02")).default,
  },
  {
    config: systems,
    load: async () => (await import("./scenes/scene-03")).default,
  },
  {
    config: workflow,
    load: async () => (await import("./scenes/scene-04")).default,
  },
  {
    config: offscreen,
    load: async () => (await import("./scenes/scene-05")).default,
  },
  {
    config: curiosity,
    load: async () => (await import("./scenes/scene-06")).default,
  },
  {
    config: creation,
    load: async () => (await import("./scenes/scene-07")).default,
  },
  {
    config: continuation,
    load: async () => (await import("./actions/continue")).default,
  },
];

export default reel;
