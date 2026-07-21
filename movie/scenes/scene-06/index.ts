import type { SceneModule } from "@movie/types/scene";
import { startAmbient, startScore, bigImpact, chordGlow, whoosh } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

/**
 * Scene 06 — The Launch Deck.
 *
 * A compact mission-control finale. It closes the reel with a launch
 * sequence: route map, build checklist, telemetry pulses, then a clean
 * ignition flash.
 */

const CHECKS = [
  "repo synced",
  "tests green",
  "bundle sealed",
  "assets warm",
  "crew ready",
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
  const stops: (() => void)[] = [];

  const module: SceneModule = {
    config: scene,
    script,

    async preload() {},

    create(r) {
      root = r;
      r.innerHTML = `
        <div class="launch-stars"></div>
        <div class="launch-map">
          <div class="launch-orbit orbit-a"></div>
          <div class="launch-orbit orbit-b"></div>
          <div class="launch-route"></div>
          <div class="launch-node node-origin"></div>
          <div class="launch-node node-mid"></div>
          <div class="launch-node node-target"></div>
          <div class="launch-craft"></div>
        </div>
        <section class="launch-console">
          <div class="launch-kicker">FINAL SEQUENCE</div>
          <h2>把代码送上轨道</h2>
          <div class="launch-progress"><span></span></div>
          <div class="launch-readout">T-05 · waiting for clean signal</div>
        </section>
        <aside class="launch-checklist"></aside>
        <div class="launch-flash">SHIP IT</div>
      `;

      const stars = r.querySelector(".launch-stars") as HTMLElement;
      for (let i = 0; i < 46; i++) {
        const star = el("i");
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.opacity = String(0.22 + Math.random() * 0.72);
        star.style.animationDelay = `${Math.random() * 1.8}s`;
        stars.appendChild(star);
      }

      const checklist = r.querySelector(".launch-checklist") as HTMLElement;
      CHECKS.forEach((check) => {
        const item = el("div", "launch-check", check);
        checklist.appendChild(item);
      });

      stops.push(startAmbient("warm", 0.07));
      stops.push(startScore("launch", 0.046));
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

      const map = root.querySelector(".launch-map") as HTMLElement;
      const consoleEl = root.querySelector(".launch-console") as HTMLElement;
      const route = root.querySelector(".launch-route") as HTMLElement;
      const craft = root.querySelector(".launch-craft") as HTMLElement;
      const progress = root.querySelector(".launch-progress span") as HTMLElement;
      const readout = root.querySelector(".launch-readout") as HTMLElement;
      const checks = Array.from(root.querySelectorAll(".launch-check")) as HTMLElement[];
      const flash = root.querySelector(".launch-flash") as HTMLElement;
      const nodes = Array.from(root.querySelectorAll(".launch-node")) as HTMLElement[];

      tl.fromTo(root, { filter: "brightness(0.62)" }, { filter: "brightness(1)", duration: 1.2 }, 0);
      tl.fromTo(map, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.8 }, 0.3);
      tl.fromTo(consoleEl, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.7 }, 0.6);
      tl.fromTo(route, { scaleX: 0 }, { scaleX: 1, duration: 2.3, ease: "power2.inOut" }, 1.2);

      nodes.forEach((node, i) => {
        tl.fromTo(node, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.28 }, 1.0 + i * 0.55);
      });

      checks.forEach((item, i) => {
        const at = 2.2 + i * 0.78;
        tl.fromTo(item, { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: 0.35 }, at);
        tl.call(() => {
          item.classList.add("is-done");
          readout.textContent = `T-0${Math.max(0, 5 - i)} · ${CHECKS[i]}`;
          bigImpact();
        }, [], at + 0.34);
      });

      tl.fromTo(progress, { scaleX: 0 }, { scaleX: 1, duration: 5.8, ease: "power1.inOut" }, 2.0);
      tl.fromTo(
        craft,
        { x: "-34vmin", y: "18vmin", rotate: -12, opacity: 0 },
        { x: "0vmin", y: "0vmin", rotate: 0, opacity: 1, duration: 3.0, ease: "power2.out" },
        3.4,
      );
      tl.to(craft, { x: "32vmin", y: "-20vmin", rotate: 18, duration: 2.7, ease: "power2.in" }, 8.0);
      tl.call(() => {
        readout.textContent = "T-00 · ignition";
        whoosh();
      }, [], 8.0);

      tl.fromTo(flash, { opacity: 0, scale: 0.82 }, { opacity: 1, scale: 1, duration: 0.4 }, 10.8);
      tl.call(() => chordGlow(), [], 10.8);
      tl.to(flash, { opacity: 0, scale: 1.08, duration: 0.85 }, 11.45);
      tl.to(root, { filter: "brightness(0.35)", duration: 1.2 }, 12.4);
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
