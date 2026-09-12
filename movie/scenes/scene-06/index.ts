import type { SceneModule } from "@movie/types/scene";
import { chordGlow } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

function createScene(): SceneModule {
  let root: HTMLElement | null = null;

  return {
    config: scene,
    script,
    async preload() {},

    create(r) {
      root = r;
      r.innerHTML = `
        <div class="finale-stars" aria-hidden="true"></div>
        <div class="finale-track" aria-hidden="true">
          <span></span><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
        </div>
        <section class="finale-copy">
          <span>NOT THE END</span>
          <h2>未完待续</h2>
          <p>下一幕还在写，镜头先停在这里。</p>
          <a href="https://github.com/wsgggws" target="_blank" rel="noreferrer">
            <small>片尾之后</small>
            <strong>github.com/wsgggws ↗</strong>
          </a>
        </section>
      `;

      const stars = r.querySelector(".finale-stars") as HTMLElement;
      for (let index = 0; index < 36; index++) {
        const star = document.createElement("i");
        star.style.left = `${8 + Math.random() * 84}%`;
        star.style.top = `${8 + Math.random() * 84}%`;
        star.style.opacity = String(0.12 + Math.random() * 0.48);
        stars.appendChild(star);
      }
    },

    async warmup() {
      if (typeof document.fonts?.ready !== "undefined") {
        try { await document.fonts.ready; } catch { /* ignore */ }
      }
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    },

    play(timeline) {
      if (!root) return;
      const track = root.querySelector(".finale-track span") as HTMLElement;
      const markers = Array.from(root.querySelectorAll(".finale-track i")) as HTMLElement[];
      const copy = root.querySelector(".finale-copy") as HTMLElement;
      const link = root.querySelector(".finale-copy a") as HTMLElement;

      timeline.fromTo(track, { scaleX: 0 }, { scaleX: 1, duration: 3.4, ease: "power2.inOut" }, 0.5);
      markers.forEach((marker, index) => {
        timeline.fromTo(
          marker,
          { opacity: 0, scale: 0.2 },
          { opacity: 1, scale: 1, duration: 0.35 },
          0.8 + index * 0.42,
        );
      });
      timeline.fromTo(copy, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.1 }, 3.8);
      timeline.call(() => chordGlow(), [], 4.2);
      timeline.fromTo(link, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.8 }, 5.4);
      timeline.to({} as object, { duration: 5.2 }, 6.2);
    },

    pause() {},
    destroy() {
      root = null;
    },
  };
}

export default createScene();
