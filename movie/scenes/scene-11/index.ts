import type { SceneModule } from "@movie/types/scene";
import { startAmbient, startScore, typingClick, chordGlow } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

const TOOLS = [
  "Tmux",
  "Neovim",
  "Python",
  "Go",
  "Linux",
  "Docker",
  "Git",
  "PostgreSQL",
  "Redis",
  "Nginx",
  "Kubernetes",
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
        <div class="tool-orbit">
          <div class="tool-core">
            <span>TECHNOLOGIES & TOOLS</span>
            <strong>quiet instruments</strong>
          </div>
        </div>
        <div class="tool-readout">
          <span>maintainability</span>
          <span>observability</span>
          <span>deployability</span>
        </div>
      `;

      const orbit = r.querySelector(".tool-orbit") as HTMLElement;
      TOOLS.forEach((tool, i) => {
        const node = document.createElement("div");
        node.className = "tool-node";
        node.textContent = tool;
        node.style.setProperty("--i", String(i));
        node.style.setProperty("--total", String(TOOLS.length));
        orbit.appendChild(node);
      });

      stops.push(startAmbient("digital", 0.045));
      stops.push(startScore("noir", 0.038));
    },

    async warmup() {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    },

    play(tl) {
      if (!root) return;
      const core = root.querySelector(".tool-core") as HTMLElement;
      const nodes = Array.from(root.querySelectorAll(".tool-node")) as HTMLElement[];
      const readout = Array.from(root.querySelectorAll(".tool-readout span")) as HTMLElement[];

      tl.fromTo(core, { opacity: 0, scale: 0.82 }, { opacity: 1, scale: 1, duration: 0.55 }, 0.4);
      nodes.forEach((node, i) => {
        const at = 0.9 + i * 0.34;
        tl.fromTo(node, { opacity: 0, scale: 0.76 }, { opacity: 1, scale: 1, duration: 0.28 }, at);
        tl.call(() => typingClick(), [], at + 0.08);
      });
      readout.forEach((item, i) => {
        tl.fromTo(item, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.34 }, 4.6 + i * 0.48);
      });
      tl.call(() => chordGlow(), [], 6.6);
      tl.to(core, { filter: "brightness(1.4)", duration: 0.35, yoyo: true, repeat: 2 }, 6.6);
      tl.to({} as object, { duration: 2.2 }, 7.8);
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
