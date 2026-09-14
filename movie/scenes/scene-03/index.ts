import type { SceneModule } from "@movie/types/scene";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

const SIGNALS = [
  ["REQUEST", "需求进入系统"],
  ["CONTRACT", "先把承诺写清楚"],
  ["TRACE", "每次判断都留下线索"],
  ["RECOVERY", "失败时降级，而不是失联"],
  ["ENGINEER", "理解问题，再修改系统"],
  ["RESPONSE", "信任被完整返回"],
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
        <div class="api-grid" aria-hidden="true"></div>
        <header class="api-heading">
          <span>SYSTEMS</span>
          <h2>接口不是边界，<br />是系统之间的承诺</h2>
        </header>
        <div class="api-route">
          <div class="api-wire" aria-hidden="true"></div>
          <div class="api-chat"></div>
        </div>
        <aside class="api-status">
          <div><i></i><span>READABLE</span><strong>清楚</strong></div>
          <div><i></i><span>OBSERVABLE</span><strong>可见</strong></div>
          <div><i></i><span>RECOVERABLE</span><strong>从容</strong></div>
        </aside>
      `;

      const chat = r.querySelector(".api-chat") as HTMLElement;
      SIGNALS.forEach(([speaker, message], index) => {
        const row = document.createElement("section");
        row.className = `api-msg api-msg--${speaker.toLowerCase()}`;
        row.innerHTML = `
          <small>${String(index + 1).padStart(2, "0")}</small>
          <span>${speaker}</span>
          <p>${message}</p>
        `;
        chat.appendChild(row);
      });
    },

    async warmup() {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    },

    play(timeline) {
      if (!root) return;
      const portrait = root.clientHeight > root.clientWidth;
      const heading = root.querySelector(".api-heading") as HTMLElement;
      const wire = root.querySelector(".api-wire") as HTMLElement;
      const messages = Array.from(root.querySelectorAll(".api-msg")) as HTMLElement[];
      const statusItems = Array.from(root.querySelectorAll(".api-status div")) as HTMLElement[];

      timeline.fromTo(heading, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.75 }, 0.3);
      timeline.fromTo(
        wire,
        portrait ? { scaleY: 0 } : { scaleX: 0 },
        portrait
          ? { scaleY: 1, duration: 6.2, ease: "power1.inOut" }
          : { scaleX: 1, duration: 6.2, ease: "power1.inOut" },
        0.9,
      );
      messages.forEach((message, index) => {
        timeline.fromTo(
          message,
          { opacity: 0, scale: 0.86 },
          { opacity: 1, scale: 1, duration: 0.48, ease: "back.out(1.4)" },
          1.15 + index * 0.78,
        );
      });
      statusItems.forEach((item, index) => {
        timeline.fromTo(item, { opacity: 0 }, { opacity: 1, duration: 0.55 }, 5.8 + index * 0.35);
      });
      timeline.to({} as object, { duration: 0.8 }, 7.2);
    },

    pause() {},
    destroy() {
      root = null;
    },
  };
}

export default createScene();
