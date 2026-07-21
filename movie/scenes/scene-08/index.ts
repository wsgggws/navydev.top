import type { SceneModule } from "@movie/types/scene";
import { startAmbient, startScore, typingClick, bigImpact, chordGlow } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

const MESSAGES = [
  ["CLIENT", "GET /heart"],
  ["API", "200 ok, 今天心情还不错"],
  ["CLIENT", "PATCH /temper"],
  ["API", "409 conflict, 闹脾气中"],
  ["ENGINEER", "retry with patience"],
  ["API", "503 crash, 我先躺一下"],
  ["ENGINEER", "I stay. I trace. I take the blame."],
  ["API", "200 recovered"],
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
          <div class="api-kicker">WEBAPI RELATIONSHIP LOG</div>
          <h2>闹脾气，我哄；崩溃，我陪；宕机，我背锅</h2>
          <div class="api-chat"></div>
        </section>
        <aside class="api-status">
          <span>CONTRACT</span>
          <strong>stable</strong>
          <span>LATENCY</span>
          <strong>42ms</strong>
          <span>ERROR BUDGET</span>
          <strong>recovering</strong>
        </aside>
      `;

      const chat = r.querySelector(".api-chat") as HTMLElement;
      MESSAGES.forEach(([speaker, message]) => {
        const row = document.createElement("div");
        row.className = "api-msg api-msg--" + speaker.toLowerCase();
        row.innerHTML = `<span>${speaker}</span><p>${message}</p>`;
        chat.appendChild(row);
      });

      stops.push(startAmbient("digital", 0.05));
      stops.push(startScore("signal", 0.038));
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
      const statusItems = Array.from(root.querySelectorAll(".api-status strong")) as HTMLElement[];

      tl.fromTo(consoleEl, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.55 }, 0.3);
      tl.fromTo(wire, { scaleX: 0 }, { scaleX: 1, duration: 6.8, ease: "power1.inOut" }, 0.8);

      messages.forEach((message, i) => {
        const at = 1.0 + i * 0.62;
        tl.fromTo(message, { opacity: 0, x: i % 2 === 0 ? -18 : 18 }, { opacity: 1, x: 0, duration: 0.32 }, at);
        tl.call(() => {
          typingClick();
          if (i === 3 || i === 5) bigImpact();
          if (i === 7) chordGlow();
        }, [], at + 0.12);
      });

      statusItems.forEach((item, i) => {
        tl.fromTo(item, { opacity: 0.45 }, { opacity: 1, duration: 0.25, yoyo: true, repeat: 5 }, 1.6 + i * 1.4);
      });
      tl.to({} as object, { duration: 2.2 }, 7.6);
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
