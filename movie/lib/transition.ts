import { gsap } from "gsap";
import type { SceneConfig } from "../types/scene";

/**
 * Title card overlay shown briefly when a new scene enters.
 * Pure DOM + GSAP — respects Director's pause/play via the timeline.
 */
export interface TitleCardHandle {
  show(config: SceneConfig, chapterLabel?: string): void;
  dispose(): void;
}

export function mountTitleCard(host: HTMLElement): TitleCardHandle {
  const card = document.createElement("div");
  card.className = "title-card";
  card.innerHTML = `
    <div class="title-card__chapter"></div>
    <div class="title-card__title"></div>
    <div class="title-card__caption"></div>
    <div class="title-card__rule"></div>
  `;
  host.appendChild(card);

  const chapterEl = card.querySelector(".title-card__chapter") as HTMLElement;
  const titleEl = card.querySelector(".title-card__title") as HTMLElement;
  const captionEl = card.querySelector(".title-card__caption") as HTMLElement;

  return {
    show(config: SceneConfig, chapterLabel?: string) {
      gsap.killTweensOf([card, chapterEl, titleEl, captionEl]);
      card.className = [
        "title-card",
        `title-card--${config.titleCard ?? "chapter-card"}`,
        `title-card--mood-${config.mood}`,
        `title-card--pace-${config.pacing}`,
        `title-card--grade-${config.colorGrade}`,
      ].join(" ");
      chapterEl.textContent = chapterLabel ?? config.id.toUpperCase().replace(/-/g, " · ");
      titleEl.textContent = config.title;
      captionEl.textContent = config.caption ?? "";
      captionEl.hidden = !config.caption;

      const hold =
        config.pacing === "hold" || config.titleCard === "silent-card"
          ? 0.8
          : config.pacing === "staccato"
            ? 0.32
            : 0.48;
      const enterY = config.titleCard === "terminal-caption" ? 0 : 16;
      const enterScale = config.titleCard === "burn-in" ? 1.06 : 1;

      // GSAP overload resolution on fromTo loses element inference in strict mode.
      // Casting through `any` keeps the runtime behaviour identical.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g: any = gsap;
      g.fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power2.out" });
      g.fromTo(
        titleEl,
        { y: enterY, scale: enterScale },
        { y: 0, scale: 1, duration: 0.65, ease: "power3.out" },
        "<",
      );
      g.fromTo(captionEl, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.48, delay: 0.1 }, "<");
      g.to(card, { opacity: 0, duration: 0.3, delay: hold, ease: "power2.in" });
    },
    dispose() {
      gsap.killTweensOf(card);
      card.remove();
    },
  };
}

/**
 * Iris wipe — circles close in on the screen during a "focus pull" feel.
 * Used by scenes that want a closing iris without changing config.transition.
 */
export function irisClose(host: HTMLElement, duration = 1.0): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:absolute; inset:0; z-index:75; pointer-events:none;
      background: radial-gradient(circle at center, transparent 0%, transparent 0%, black 0%);
      animation: iris-${Date.now()} ${duration}s ease-in forwards;
    `;
    host.appendChild(overlay);
    const kf = `
      @keyframes iris-${Date.now()} {
        0%   { clip-path: circle(0% at 50% 50%); }
        100% { clip-path: circle(150% at 50% 50%); }
      }
    `;
    const style = document.createElement("style");
    style.textContent = kf;
    document.head.appendChild(style);
    overlay.addEventListener("animationend", () => {
      overlay.remove();
      style.remove();
      resolve();
    });
  });
}

/** Re-exported for type imports of scene config across the lib boundary. */
export type { SceneConfig };
