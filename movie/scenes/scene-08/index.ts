import type { SceneModule } from "@movie/types/scene";
import { typingClick, chordGlow } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

const MESSAGES = [
  ["REQUEST", "需求进入系统"],
  ["CONTRACT", "先把承诺写清楚"],
  ["TRACE", "每次判断都留下线索"],
  ["RECOVERY", "失败时降级，而不是失联"],
  ["ENGINEER", "理解问题，再修改系统"],
  ["RESPONSE", "信任被完整返回"],
];

function createScene(): SceneModule {
  let root: HTMLElement | null = null;
  const stops: (() => void)[] = [];

  const module: SceneModule = {
    config: scene,
    script,

    async preload() {},

    create(r) {
      root = r;
      r.innerHTML = `
        <div class="api-wire"></div>
        <section class="api-console">
          <div class="api-kicker">SYSTEMS</div>
          <h2>接口不是边界，<br />是系统之间的承诺</h2>
          <div class="api-chat"></div>
        </section>
        <aside class="api-status">
          <div><span>READABLE</span><strong>清楚</strong></div>
          <div><span>OBSERVABLE</span><strong>可见</strong></div>
          <div><span>RECOVERABLE</span><strong>从容</strong></div>
        </aside>
      `;

      const chat = r.querySelector(".api-chat") as HTMLElement;
      MESSAGES.forEach(([speaker, message]) => {
        const row = document.createElement("div");
        row.className = "api-msg api-msg--" + speaker.toLowerCase();
        row.innerHTML = `<span>${speaker}</span><p>${message}</p>`;
        chat.appendChild(row);
      });

    },

    async warmup() {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    },

    play(tl) {
      if (!root) return;
      const consoleEl = root.querySelector(".api-console") as HTMLElement;
      const wire = root.querySelector(".api-wire") as HTMLElement;
      const messages = Array.from(root.querySelectorAll(".api-msg")) as HTMLElement[];
      const statusItems = Array.from(root.querySelectorAll(".api-status div")) as HTMLElement[];

      tl.fromTo(consoleEl, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.55 }, 0.3);
      tl.fromTo(wire, { scaleX: 0 }, { scaleX: 1, duration: 7.4, ease: "power1.inOut" }, 0.8);

      messages.forEach((message, i) => {
        const at = 1.1 + i * 0.78;
        tl.fromTo(message, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4 }, at);
        tl.call(() => {
          typingClick();
          if (i === messages.length - 1) chordGlow();
        }, [], at + 0.12);
      });

      statusItems.forEach((item, i) => {
        tl.fromTo(item, { opacity: 0.35 }, { opacity: 1, duration: 0.7 }, 2.0 + i * 1.2);
      });
      tl.to({} as object, { duration: 1.8 }, 7.8);
    },

    pause() {},

    destroy() {
      while (stops.length) stops.pop()!();
      root = null;
    },
  };

  return module;
}

export default createScene();
