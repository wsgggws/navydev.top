import type { SceneModule } from "@movie/types/scene";
import { gsap } from "gsap";
import { startAmbient, startScore, typingClick, bigImpact, chordGlow, whoosh } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

/**
 * Scene 03 — Sparks.
 *
 * Neovim editor. Each typed character fires a particle. A combo counter
 * ticks up. At the end, a "FULL COMBO 💥" flash burns the screen.
 */

// spark.nvim is Lua-first, so the scene stays in Neovim plugin language.
const SNIPPETS: { lang: string; tokens: { t: string; k?: string }[] }[] = [
  {
    lang: "lua",
    tokens: [
      { t: "local ", k: "key" }, { t: "spark", k: "id" },
      { t: " = ", k: "pun" }, { t: "require", k: "fn" },
      { t: "(", k: "pun" }, { t: '"spark"', k: "str" }, { t: ")", k: "pun" },
    ],
  },
  {
    lang: "lua",
    tokens: [
      { t: "spark.", k: "id" }, { t: "setup", k: "fn" },
      { t: "({ ", k: "pun" }, { t: "combo", k: "id" },
      { t: " = ", k: "pun" }, { t: "true", k: "key" }, { t: " })", k: "pun" },
    ],
  },
  {
    lang: "lua",
    tokens: [
      { t: "vim.api.", k: "id" }, { t: "nvim_create_autocmd", k: "fn" },
      { t: "(", k: "pun" }, { t: '"TextChangedI"', k: "str" }, { t: ", {", k: "pun" },
    ],
  },
  {
    lang: "lua",
    tokens: [
      { t: "  ", k: "id" }, { t: "callback", k: "id" }, { t: " = ", k: "pun" },
      { t: "function", k: "key" }, { t: "()", k: "pun" },
      { t: " spark.", k: "id" }, { t: "burst", k: "fn" }, { t: "()", k: "pun" },
    ],
  },
  {
    lang: "lua",
    tokens: [
      { t: "end", k: "key" }, { t: ", ", k: "pun" },
      { t: "desc", k: "id" }, { t: " = ", k: "pun" },
      { t: '"spark.nvim combo"', k: "str" }, { t: " })", k: "pun" },
    ],
  },
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createScene(): SceneModule {
  let root: HTMLElement | null = null;
  let particleLayer: HTMLElement | null = null;
  let comboCounter: HTMLElement | null = null;
  let comboNum: HTMLElement | null = null;
  let fullCombo: HTMLElement | null = null;
  const stops: (() => void)[] = [];

  const module: SceneModule = {
    config: scene,
    script,

    async preload() {},

    create(r) {
      root = r;
      r.innerHTML = `
        <div class="spark-editor">
          <div class="spark-titlebar">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            <span style="margin-left:10px">~/.config/nvim/lua/spark.lua — NVIM</span>
          </div>
          <div class="spark-code"></div>
        </div>
        <div class="combo-counter">
          <span class="x">x</span>
          <span class="num">1</span>
          <span>COMBO</span>
        </div>
        <div class="spark-diagnostics">
          <span>lua require spark.nvim</span>
          <span>streak 000</span>
          <span>heat nominal</span>
        </div>
        <div class="full-combo">FULL COMBO 💥</div>
        <div class="spark-layer"></div>
      `;
      particleLayer = r.querySelector(".spark-layer");
      comboCounter = r.querySelector(".combo-counter");
      comboNum = r.querySelector(".combo-counter .num");
      fullCombo = r.querySelector(".full-combo");

      // Audio: digital ambient bed, low.
      stops.push(startAmbient("digital", 0.06));
      stops.push(startScore("rush", 0.036));
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
      const code = root.querySelector(".spark-code") as HTMLElement;
      const fireParticle = (from: { x: number; y: number }) => {
        if (!particleLayer) return;
        const p = el("div", "spark-particle");
        p.style.left = from.x + "px";
        p.style.top = from.y + "px";
        particleLayer.appendChild(p);
        const dx = (Math.random() - 0.5) * 80;
        const dy = -120 - Math.random() * 80;
        gsap.fromTo(
          p,
          { x: 0, y: 0, scale: 1, opacity: 1 },
          {
            x: dx,
            y: dy,
            scale: 0.2,
            opacity: 0,
            duration: 0.9,
            ease: "power2.out",
            onComplete() {
              p.remove();
            },
          },
        );
        typingClick();
        if (Math.random() < 0.08) whoosh();
      };

      // Lines fade in, characters animate in token by token.
      SNIPPETS.forEach((snippet, lineIdx) => {
        const lineEl = el("div", "spark-line");
        lineEl.appendChild(
          el("span", "ln", String(lineIdx + 1).padStart(2, " ") + " "),
        );
        code.appendChild(lineEl);

        // Reveal the line.
        const lineAppearAt = 0.55 + lineIdx * 2.1;
        tl.fromTo(lineEl, { opacity: 0 }, { opacity: 1, duration: 0.2 }, lineAppearAt);

        // Tokens appear one by one.
        let charOffset = 0;
        snippet.tokens.forEach((tok) => {
          const tokenAppearAt = lineAppearAt + 0.2 + charOffset * 0.04;
          const span = el("span", tok.k ? "tok-" + tok.k : "tok-id");
          span.textContent = tok.t;
          span.style.opacity = "0";
          lineEl.appendChild(span);
          tl.to(span, { opacity: 1, duration: 0.15 }, tokenAppearAt);

          // Fire particles for every non-whitespace character.
          for (let c = 0; c < tok.t.length; c++) {
            if (/\s/.test(tok.t[c])) continue;
            const charAppearAt = tokenAppearAt + c * 0.04;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (tl as any).call(
              () => {
                fireParticle({ x: 200 + charOffset * 12, y: 220 + lineIdx * 36 });
              },
              [],
              charAppearAt,
            );
            charOffset++;
          }
          charOffset += tok.t.length;
        });
      });

      // Combo counter appears early, animates up on each "hit".
      if (comboCounter) {
        tl.fromTo(comboCounter, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.4 }, 1);
      }
      const diagnostics = Array.from(root.querySelectorAll(".spark-diagnostics span")) as HTMLElement[];
      diagnostics.forEach((item, i) => {
        tl.fromTo(item, { opacity: 0.35 }, { opacity: 1, duration: 0.25, yoyo: true, repeat: 9 }, 2 + i * 0.4);
      });
      const comboTargets = [3, 9, 23, 47, 73];
      comboTargets.forEach((target, i) => {
        tl.call(() => {
          if (comboNum) comboNum.textContent = String(target);
          const streak = root?.querySelector(".spark-diagnostics span:nth-child(2)");
          if (streak) streak.textContent = "streak " + String(target).padStart(3, "0");
          if (comboCounter) {
            comboCounter.style.transform = "scale(1.08)";
          }
          bigImpact();
        }, [], 2 + i * 1.35);
        tl.to(comboCounter ?? root!, { scale: 1, duration: 0.2 }, 2 + i * 1.35 + 0.05);
      });

      // FULL COMBO flash at the end.
      tl.fromTo(fullCombo ?? root!, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.45, ease: "power2.out" }, 12.8);
      tl.to(fullCombo ?? root!, { opacity: 0, duration: 0.75 }, 14.05);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tl as any).call(() => chordGlow(), [], 12.8);
    },

    pause() {},

    destroy() {
      while (stops.length) stops.pop()!();
      root = null;
      particleLayer = null;
      comboCounter = null;
      comboNum = null;
      fullCombo = null;
    },
  };
  return module;
}

export default createScene();
