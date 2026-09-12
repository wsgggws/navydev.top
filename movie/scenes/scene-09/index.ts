import type { SceneModule } from "@movie/types/scene";
import { chordGlow } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

const MOMENTS = [
  {
    number: "01",
    verb: "READ",
    title: "向过去借一双眼睛",
    detail: "历史 · 长文 · 纸页",
  },
  {
    number: "02",
    verb: "RUN",
    title: "把复杂的问题交给脚步",
    detail: "配速 · 呼吸 · 路线",
  },
  {
    number: "03",
    verb: "NOTICE",
    title: "看见日常里正在发生的事",
    detail: "街道 · 光线 · 人群",
  },
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
        <div class="life-light" aria-hidden="true"></div>
        <header class="life-heading">
          <span>OFF SCREEN</span>
          <h2>屏幕之外，<br />生活继续编译</h2>
        </header>
        <div class="life-moments"></div>
        <p class="life-coda">离开屏幕，才能带着新的东西回来。</p>
      `;

      const moments = r.querySelector(".life-moments") as HTMLElement;
      MOMENTS.forEach(({ number, verb, title, detail }) => {
        const item = document.createElement("section");
        item.className = `life-moment life-moment--${verb.toLowerCase()}`;
        item.innerHTML = `
          <span>${number}</span>
          <strong>${verb}</strong>
          <h3>${title}</h3>
          <p>${detail}</p>
          <i aria-hidden="true"></i>
        `;
        moments.appendChild(item);
      });
    },

    async warmup() {
      if (typeof document.fonts?.ready !== "undefined") {
        try { await document.fonts.ready; } catch { /* ignore */ }
      }
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    },

    play(timeline) {
      if (!root) return;
      const heading = root.querySelector(".life-heading") as HTMLElement;
      const moments = Array.from(root.querySelectorAll(".life-moment")) as HTMLElement[];
      const coda = root.querySelector(".life-coda") as HTMLElement;

      timeline.fromTo(heading, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8 }, 0.3);
      moments.forEach((moment, index) => {
        const at = 1.1 + index * 1.35;
        timeline.fromTo(moment, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.75 }, at);
        timeline.fromTo(
          moment.querySelector("i"),
          { scaleX: 0 },
          { scaleX: 1, duration: 1.5, ease: "power2.out" },
          at + 0.25,
        );
      });
      timeline.fromTo(coda, { opacity: 0 }, { opacity: 1, duration: 0.9 }, 5.8);
      timeline.call(() => chordGlow(), [], 6.2);
      timeline.to({} as object, { duration: 3 }, 7.2);
    },

    pause() {},
    destroy() {
      root = null;
    },
  };
}

export default createScene();
