import type { SceneModule } from "@movie/types/scene";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

const PROMPTS = [
  { word: "WHY", question: "真正重要的是什么？", tone: "先追问原因" },
  { word: "WHAT IF", question: "如果换一个方向呢？", tone: "再打开可能" },
  { word: "WHAT NEXT", question: "下一步能验证什么？", tone: "最后走向行动" },
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
        <div class="curiosity-orbit" aria-hidden="true"><i></i><i></i><i></i></div>
        <header class="curiosity-heading">
          <span>CURIOSITY</span>
          <h2>答案会过期，<br />提问让人继续前进</h2>
        </header>
        <div class="curiosity-prompts"></div>
        <p class="curiosity-coda">保持好奇，也保持行动。</p>
      `;

      const prompts = r.querySelector(".curiosity-prompts") as HTMLElement;
      PROMPTS.forEach(({ word, question, tone }) => {
        const item = document.createElement("section");
        item.className = "curiosity-prompt";
        item.innerHTML = `<strong>${word}</strong><h3>${question}</h3><p>${tone}</p>`;
        prompts.appendChild(item);
      });
    },

    async warmup() {
      if (typeof document.fonts?.ready !== "undefined") {
        try { await document.fonts.ready; } catch { /* ignore */ }
      }
    },

    play(timeline) {
      if (!root) return;
      const heading = root.querySelector(".curiosity-heading") as HTMLElement;
      const rings = Array.from(root.querySelectorAll(".curiosity-orbit i")) as HTMLElement[];
      const prompts = Array.from(root.querySelectorAll(".curiosity-prompt")) as HTMLElement[];
      const coda = root.querySelector(".curiosity-coda") as HTMLElement;

      timeline.fromTo(heading, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9 }, 0.35);
      rings.forEach((ring, index) => {
        timeline.fromTo(
          ring,
          { opacity: 0, scale: 0.72 },
          { opacity: 1 - index * 0.22, scale: 1, duration: 1.5, ease: "power2.out" },
          0.8 + index * 0.48,
        );
      });
      prompts.forEach((prompt, index) => {
        timeline.fromTo(
          prompt,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.75, ease: "power2.out" },
          2.0 + index * 1.35,
        );
      });
      timeline.fromTo(coda, { opacity: 0 }, { opacity: 1, duration: 0.9 }, 6.5);
      timeline.to({} as object, { duration: 0.8 }, 7.4);
    },

    pause() {},
    destroy() {
      root = null;
    },
  };
}

export default createScene();
