import type { SceneModule } from "@movie/types/scene";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

const FRAMES = [
  ["01", "THINK", "想清楚", "思考不是等待，而是确认方向。"],
  ["02", "MAKE", "做出来", "原型让模糊的想法开始成形。"],
  ["03", "RELEASE", "放进去", "让真实世界给出新的答案。"],
  ["04", "REFINE", "再改好", "下一版，永远比结论更重要。"],
];

function createScene(): SceneModule {
  let root: HTMLElement | null = null;

  return {
    config: scene,
    script,
    async preload() {},

    create(r) {
      root = r;
      r.innerHTML = `
        <div class="creation-perforations" aria-hidden="true"></div>
        <section class="creation-story">
          <header class="creation-heading">
            <span>CREATION</span>
            <h2>把想法，<br />带进现实</h2>
            <p>生活没有现成剧本。边走、边拍、边修改。</p>
          </header>
          <div class="creation-track" aria-hidden="true"></div>
          <div class="creation-frames"></div>
          <p class="creation-coda">作品不是句号，是下一次行动的起点。</p>
        </section>
      `;

      const frames = r.querySelector(".creation-frames") as HTMLElement;
      FRAMES.forEach(([number, verb, title, detail]) => {
        const frame = document.createElement("figure");
        frame.className = "creation-frame";
        frame.innerHTML = `
          <figcaption><span>${number} · ${verb}</span><strong>${title}</strong></figcaption>
          <p>${detail}</p>
        `;
        frames.appendChild(frame);
      });
    },

    async warmup() {
      if (typeof document.fonts?.ready !== "undefined") {
        try { await document.fonts.ready; } catch { /* ignore */ }
      }
    },

    play(timeline) {
      if (!root) return;
      const heading = root.querySelector(".creation-heading") as HTMLElement;
      const track = root.querySelector(".creation-track") as HTMLElement;
      const frames = Array.from(root.querySelectorAll(".creation-frame")) as HTMLElement[];
      const coda = root.querySelector(".creation-coda") as HTMLElement;

      timeline.fromTo(heading, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8 }, 0.3);
      timeline.fromTo(track, { scaleX: 0 }, { scaleX: 1, duration: 4.4, ease: "power2.inOut" }, 0.9);
      frames.forEach((frame, index) => {
        timeline.fromTo(
          frame,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.62, ease: "power2.out" },
          1.2 + index * 0.85,
        );
      });
      timeline.fromTo(coda, { opacity: 0 }, { opacity: 1, duration: 0.75 }, 5.2);
      timeline.to({}, { duration: 0.85 }, 5.95);
    },

    pause() {},
    destroy() {
      root = null;
    },
  };
}

export default createScene();
