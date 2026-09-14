import type { SceneModule } from "@movie/types/scene";
import { typingClick, chordGlow } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

const WORKFLOW = [
  { step: "01", verb: "THINK", idea: "先理解，再动手", tools: "Tmux · Neovim" },
  { step: "02", verb: "BUILD", idea: "选择合适的表达", tools: "Python · Go" },
  { step: "03", verb: "RUN", idea: "让环境可以复现", tools: "Linux · Docker" },
  { step: "04", verb: "SHIP", idea: "让变化稳稳落地", tools: "Git · PostgreSQL · Redis · Nginx · Kubernetes" },
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
        <header class="workflow-heading">
          <span>WORKFLOW</span>
          <h2>工具退到身后，<br />工作流留在手上</h2>
        </header>
        <div class="workflow-line" aria-hidden="true"></div>
        <div class="workflow-steps"></div>
        <p class="workflow-coda">工具不是收藏品。它们只负责让思考更专注，让交付更从容。</p>
      `;

      const steps = r.querySelector(".workflow-steps") as HTMLElement;
      WORKFLOW.forEach(({ step, verb, idea, tools }) => {
        const item = document.createElement("section");
        item.className = "workflow-step";
        item.innerHTML = `
          <span>${step}</span>
          <strong>${verb}</strong>
          <p>${idea}</p>
          <small>${tools}</small>
        `;
        steps.appendChild(item);
      });
    },

    async warmup() {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    },

    play(timeline) {
      if (!root) return;
      const heading = root.querySelector(".workflow-heading") as HTMLElement;
      const line = root.querySelector(".workflow-line") as HTMLElement;
      const steps = Array.from(root.querySelectorAll(".workflow-step")) as HTMLElement[];
      const coda = root.querySelector(".workflow-coda") as HTMLElement;

      timeline.fromTo(heading, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, 0.25);
      timeline.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 5.2, ease: "power2.inOut" }, 0.8);
      steps.forEach((step, index) => {
        const at = 1.0 + index * 1.15;
        timeline.fromTo(step, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.55 }, at);
        timeline.call(() => typingClick(), [], at + 0.12);
      });
      timeline.fromTo(coda, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.7 }, 6.0);
      timeline.call(() => chordGlow(), [], 6.3);
      timeline.to({} as object, { duration: 0.8 }, 7.2);
    },

    pause() {},
    destroy() {
      root = null;
    },
  };
}

export default createScene();
