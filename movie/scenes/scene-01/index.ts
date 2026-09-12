import type { SceneModule } from "@movie/types/scene";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

const QUESTIONS = [
  { key: "QUESTION", title: "问题真正发生在哪里？", detail: "先缩小范围，再决定从哪里开始。" },
  { key: "EVIDENCE", title: "哪些事实可以复现？", detail: "让判断来自证据，而不是直觉。" },
  { key: "CHANGE", title: "怎样用最小改动验证？", detail: "一次只改变一件事，并留下退路。" },
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
        <div class="method-grid" aria-hidden="true"></div>
        <header class="method-heading">
          <span>METHOD</span>
          <h2>先问清楚，<br />再写答案</h2>
          <p>真正有效的修改，通常始于一个更准确的问题。</p>
        </header>
        <div class="method-route" aria-hidden="true"><i></i></div>
        <div class="method-questions"></div>
        <p class="method-coda">理解 · 证据 · 小步验证</p>
      `;

      const questions = r.querySelector(".method-questions") as HTMLElement;
      QUESTIONS.forEach(({ key, title, detail }, index) => {
        const item = document.createElement("section");
        item.className = "method-question";
        item.innerHTML = `
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${key}</strong>
          <h3>${title}</h3>
          <p>${detail}</p>
        `;
        questions.appendChild(item);
      });
    },

    async warmup() {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    },

    play(timeline) {
      if (!root) return;
      const heading = root.querySelector(".method-heading") as HTMLElement;
      const route = root.querySelector(".method-route i") as HTMLElement;
      const questions = Array.from(root.querySelectorAll(".method-question")) as HTMLElement[];
      const coda = root.querySelector(".method-coda") as HTMLElement;

      timeline.fromTo(heading, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9 }, 0.35);
      timeline.fromTo(route, { scaleY: 0 }, { scaleY: 1, duration: 4.8, ease: "power2.inOut" }, 1.1);
      questions.forEach((question, index) => {
        timeline.fromTo(
          question,
          { opacity: 0, x: 20 },
          { opacity: 1, x: 0, duration: 0.75, ease: "power2.out" },
          1.45 + index * 1.45,
        );
      });
      timeline.fromTo(coda, { opacity: 0 }, { opacity: 1, duration: 0.8 }, 6.4);
      timeline.to({} as object, { duration: 3 }, 7.2);
    },

    pause() {},
    destroy() {
      root = null;
    },
  };
}

export default createScene();
