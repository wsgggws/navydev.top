import type { SceneModule } from "@movie/types/scene";
import { startAmbient, startScore, bigImpact, chordGlow, typingClick } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

const BUGS = [
  "race: request cache",
  "deadlock near GIL",
  "goroutine leak",
  "retry storm",
  "nil pointer",
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
        <div class="bug-runtime bug-runtime--py">
          <span>PYTHON</span>
          <strong>GIL</strong>
          <code>with lock: reproduce()</code>
        </div>
        <div class="bug-runtime bug-runtime--go">
          <span>GO</span>
          <strong>GOROUTINE</strong>
          <code>go observe(trace)</code>
        </div>
        <div class="bug-forge-core">
          <div class="bug-core-ring"></div>
          <h2>专业创造 Bug</h2>
          <p>然后优雅修复</p>
        </div>
        <div class="bug-cards"></div>
        <div class="bug-fixline">root cause isolated · patch merged · postmortem readable</div>
      `;

      const cards = r.querySelector(".bug-cards") as HTMLElement;
      BUGS.forEach((bug) => {
        const card = document.createElement("div");
        card.className = "bug-card";
        card.textContent = bug;
        cards.appendChild(card);
      });

      stops.push(startAmbient("digital", 0.055));
      stops.push(startScore("rush", 0.038));
    },

    async warmup() {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    },

    play(tl) {
      if (!root) return;
      const runtimes = Array.from(root.querySelectorAll(".bug-runtime")) as HTMLElement[];
      const core = root.querySelector(".bug-forge-core") as HTMLElement;
      const ring = root.querySelector(".bug-core-ring") as HTMLElement;
      const cards = Array.from(root.querySelectorAll(".bug-card")) as HTMLElement[];
      const fixline = root.querySelector(".bug-fixline") as HTMLElement;

      runtimes.forEach((runtime, i) => {
        tl.fromTo(runtime, { opacity: 0, y: i === 0 ? -18 : 18 }, { opacity: 1, y: 0, duration: 0.45 }, 0.3 + i * 0.2);
      });
      tl.fromTo(core, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.55 }, 0.8);
      tl.to(ring, { rotate: 360, duration: scene.duration, ease: "none" }, 0);

      cards.forEach((card, i) => {
        const at = 1.2 + i * 0.62;
        tl.fromTo(card, { opacity: 0, y: -50, rotate: -4 }, { opacity: 1, y: 0, rotate: 0, duration: 0.35 }, at);
        tl.call(() => {
          typingClick();
          if (i % 2 === 0) bigImpact();
        }, [], at + 0.2);
        tl.to(card, { opacity: 0.35, x: i % 2 === 0 ? -18 : 18, duration: 0.35 }, at + 1.0);
      });

      tl.fromTo(fixline, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5 }, 5.9);
      tl.call(() => chordGlow(), [], 6.0);
      tl.to(core, { filter: "brightness(1.45)", duration: 0.28, yoyo: true, repeat: 3 }, 6.2);
      tl.to({} as object, { duration: 2.0 }, 8.0);
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
