import type { SceneEntry } from "./types/scene";
import { scene as hacker } from "./scenes/scene-01/config";
import { scene as terminal } from "./scenes/scene-02/config";
import { scene as sparks } from "./scenes/scene-03/config";
import { scene as garden } from "./scenes/scene-04/config";
import { scene as crabtris } from "./scenes/scene-05/config";
import { scene as launchDeck } from "./scenes/scene-06/config";
import { scene as bugForge } from "./scenes/scene-07/config";
import { scene as apiAffair } from "./scenes/scene-08/config";
import { scene as readingRoom } from "./scenes/scene-09/config";
import { scene as runnersLoop } from "./scenes/scene-10/config";
import { scene as toolchainOrbit } from "./scenes/scene-11/config";

// To add a new scene, append one line here. Nothing else changes.
const reel: SceneEntry[] = [
  {
    config: terminal,
    load: async () => (await import("./scenes/scene-02")).default,
  },
  {
    config: readingRoom,
    load: async () => (await import("./scenes/scene-09")).default,
  },
  {
    config: runnersLoop,
    load: async () => (await import("./scenes/scene-10")).default,
  },
  {
    config: hacker,
    load: async () => (await import("./scenes/scene-01")).default,
  },
  {
    config: apiAffair,
    load: async () => (await import("./scenes/scene-08")).default,
  },
  {
    config: bugForge,
    load: async () => (await import("./scenes/scene-07")).default,
  },
  {
    config: garden,
    load: async () => (await import("./scenes/scene-04")).default,
  },
  {
    config: toolchainOrbit,
    load: async () => (await import("./scenes/scene-11")).default,
  },
  {
    config: sparks,
    load: async () => (await import("./scenes/scene-03")).default,
  },
  {
    config: crabtris,
    load: async () => (await import("./scenes/scene-05")).default,
  },
  {
    config: launchDeck,
    load: async () => (await import("./scenes/scene-06")).default,
  },
];

export default reel;
