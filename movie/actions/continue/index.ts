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
        <section class="continue-action">
          <span>CONTINUE</span>
          <h2>未完待续</h2>
          <p>下一幕还在写，镜头先停在这里。</p>
          <a href="https://github.com/wsgggws" target="_blank" rel="noreferrer">
            <small>片尾之后</small>
            <strong>github.com/wsgggws ↗</strong>
          </a>
        </section>
      `;
    },

    play(timeline) {
      if (!root) return;
      const marker = root.querySelector(".continue-action > span") as HTMLElement;
      const title = root.querySelector(".continue-action h2") as HTMLElement;
      const copy = root.querySelector(".continue-action p") as HTMLElement;
      const link = root.querySelector(".continue-action a") as HTMLElement;

      timeline.fromTo(marker, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.05);
      timeline.fromTo(
        title,
        { opacity: 0, scale: 0.97 },
        { opacity: 1, scale: 1, duration: 0.65, ease: "power2.out" },
        0.12,
      );
      timeline.fromTo(copy, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.42 }, 0.58);
      timeline.fromTo(link, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45 }, 0.9);
      timeline.to({}, { duration: 1.05 }, 1.55);
    },

    pause() {},
    destroy() {
      root = null;
    },
  };
}

export default createAction();
