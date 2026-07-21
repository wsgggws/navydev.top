import type { SceneModule } from "@movie/types/scene";
import { startAmbient, startScore, typingClick, bigImpact, chordGlow } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

const SPLITS = ["km 01 · warmup", "km 02 · simplify", "km 03 · observe", "km 04 · ship"];

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
        <div class="runner-sun"></div>
        <div class="runner-route">
          <svg viewBox="0 0 640 360" role="img" aria-label="Jogging route">
            <path class="runner-route__shadow" d="M60 260 C130 80 210 300 292 164 S460 32 572 138" />
            <path class="runner-route__line" d="M60 260 C130 80 210 300 292 164 S460 32 572 138" />
          </svg>
          <div class="runner-dot"></div>
        </div>
        <section class="runner-hud">
          <span>FAVORITE PROJECT</span>
          <h2>Jogging</h2>
          <p>把复杂的问题跑到简单，再把系统一点点提升。</p>
        </section>
        <div class="runner-splits"></div>
      `;

      const splits = r.querySelector(".runner-splits") as HTMLElement;
      SPLITS.forEach((split) => {
        const item = document.createElement("div");
        item.textContent = split;
        splits.appendChild(item);
      });

      stops.push(startAmbient("warm", 0.045));
      stops.push(startScore("launch", 0.038));
    },

    async warmup() {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    },

    play(tl) {
      if (!root) return;
      const hud = root.querySelector(".runner-hud") as HTMLElement;
      const line = root.querySelector(".runner-route__line") as SVGPathElement;
      const dot = root.querySelector(".runner-dot") as HTMLElement;
      const splits = Array.from(root.querySelectorAll(".runner-splits div")) as HTMLElement[];

      tl.fromTo(hud, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.55 }, 0.4);
      tl.fromTo(line, { strokeDashoffset: 860 }, { strokeDashoffset: 0, duration: 5.8, ease: "power1.inOut" }, 0.8);
      tl.fromTo(dot, { offsetDistance: "0%", opacity: 0 }, { offsetDistance: "100%", opacity: 1, duration: 5.8, ease: "power1.inOut" }, 0.8);

      splits.forEach((split, i) => {
        const at = 1.3 + i * 1.08;
        tl.fromTo(split, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.3 }, at);
        tl.call(() => {
          typingClick();
          if (i === splits.length - 1) bigImpact();
        }, [], at + 0.1);
      });

      tl.call(() => chordGlow(), [], 6.4);
      tl.to(hud, { filter: "brightness(1.3)", duration: 0.35, yoyo: true, repeat: 2 }, 6.4);
      tl.to({} as object, { duration: 1.6 }, 7.6);
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
