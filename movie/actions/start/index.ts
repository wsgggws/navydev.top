import type { SceneModule } from "@movie/types/scene";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

function createAction(): SceneModule {
  let root: HTMLElement | null = null;

  return {
    config: scene,
    script,
    async preload() {},

    create(r) {
      root = r;
      r.innerHTML = `
        <section class="start-action">
          <span>START</span>
          <h1>生活就是自导自演的一场戏</h1>
          <i aria-hidden="true"></i>
        </section>
      `;
    },

    play(timeline) {
      if (!root) return;
      const marker = root.querySelector(".start-action span") as HTMLElement;
      const title = root.querySelector(".start-action h1") as HTMLElement;
      const rule = root.querySelector(".start-action i") as HTMLElement;

      timeline.fromTo(marker, { opacity: 0 }, { opacity: 1, duration: 0.22 }, 0.05);
      timeline.fromTo(
        title,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.48, ease: "power2.out" },
        0.12,
      );
      timeline.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.5 }, 0.28);
      timeline.to({}, { duration: 0.82 }, 0.98);
    },

    pause() {},
    destroy() {
      root = null;
    },
  };
}

export default createAction();
