import type { SceneModule } from "@movie/types/scene";
import { startAmbient, startScore, typingClick, chordGlow } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

const NOTES = [
  "竹简像磁带，换页就是 seek",
  "活字印刷：第一代 reusable component",
  "史官写日志，运维看事故",
  "没有 Claude Code，也要靠耐心 review",
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
        <div class="reading-lamp"></div>
        <article class="reading-book">
          <div class="reading-page reading-page--left">
            <span>FAVORITE PROJECT</span>
            <h2>Reading</h2>
            <p>历史是一种低速调试器。</p>
          </div>
          <div class="reading-page reading-page--right">
            <span>MARGIN NOTES</span>
            <div class="reading-notes"></div>
          </div>
        </article>
        <div class="reading-question">古人在没有 Claude Code 的时候如何 Coding 呢？</div>
      `;

      const notes = r.querySelector(".reading-notes") as HTMLElement;
      NOTES.forEach((note) => {
        const item = document.createElement("p");
        item.textContent = note;
        notes.appendChild(item);
      });

      stops.push(startAmbient("warm", 0.055));
      stops.push(startScore("garden", 0.032));
    },

    async warmup() {
      if (typeof document.fonts?.ready !== "undefined") {
        try { await document.fonts.ready; } catch { /* ignore */ }
      }
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    },

    play(tl) {
      if (!root) return;
      const book = root.querySelector(".reading-book") as HTMLElement;
      const pages = Array.from(root.querySelectorAll(".reading-page")) as HTMLElement[];
      const notes = Array.from(root.querySelectorAll(".reading-notes p")) as HTMLElement[];
      const question = root.querySelector(".reading-question") as HTMLElement;

      tl.fromTo(book, { opacity: 0, y: 24, rotateX: 8 }, { opacity: 1, y: 0, rotateX: 0, duration: 0.8 }, 0.4);
      pages.forEach((page, i) => {
        tl.fromTo(page, { filter: "brightness(0.72)" }, { filter: "brightness(1)", duration: 0.5 }, 0.9 + i * 0.25);
      });
      notes.forEach((note, i) => {
        const at = 1.6 + i * 0.72;
        tl.fromTo(note, { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: 0.36 }, at);
        tl.call(() => typingClick(), [], at + 0.1);
      });
      tl.fromTo(question, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.65 }, 5.1);
      tl.call(() => chordGlow(), [], 5.6);
      tl.to({} as object, { duration: 2.2 }, 7.0);
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
