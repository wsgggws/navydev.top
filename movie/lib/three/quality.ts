export type RenderingQuality = "high" | "balanced" | "low";

export interface RenderingProfile {
  pixelRatioCap: number;
  bloomScale: number;
}

const PROFILES: Record<RenderingQuality, RenderingProfile> = {
  high: { pixelRatioCap: 1.5, bloomScale: 1 },
  balanced: { pixelRatioCap: 1.25, bloomScale: 0.65 },
  low: { pixelRatioCap: 1, bloomScale: 0 },
};

const ORDER: RenderingQuality[] = ["low", "balanced", "high"];
type QualityListener = (quality: RenderingQuality, profile: RenderingProfile) => void;

function detectMaximumQuality(): RenderingQuality {
  const device = navigator as Navigator & { deviceMemory?: number };
  const memory = device.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency || 8;
  const mobile = window.matchMedia("(max-width: 640px)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (memory <= 2 || cores <= 2) return "low";
  if (mobile || reducedMotion || memory <= 4 || cores <= 4) return "balanced";
  return "high";
}

const maximumQuality = detectMaximumQuality();
let quality = maximumQuality;
let slowWindows = 0;
let healthyWindows = 0;
const listeners = new Set<QualityListener>();

function setQuality(next: RenderingQuality): void {
  if (next === quality) return;
  quality = next;
  document.documentElement.dataset.renderQuality = next;
  listeners.forEach((listener) => listener(next, PROFILES[next]));
}

document.documentElement.dataset.renderQuality = quality;

export function getRenderingQuality(): RenderingQuality {
  return quality;
}

export function getRenderingProfile(): RenderingProfile {
  return PROFILES[quality];
}

export function observeFrameRate(fps: number): RenderingQuality {
  if (!Number.isFinite(fps) || document.hidden) return quality;

  if (fps < 48) {
    slowWindows += fps < 34 ? 2 : 1;
    healthyWindows = 0;
  } else if (fps >= 57) {
    healthyWindows += 1;
    slowWindows = 0;
  } else {
    slowWindows = 0;
    healthyWindows = 0;
  }

  const currentIndex = ORDER.indexOf(quality);
  if (slowWindows >= 2 && currentIndex > 0) {
    slowWindows = 0;
    setQuality(ORDER[currentIndex - 1]);
  } else if (healthyWindows >= 8) {
    healthyWindows = 0;
    const maximumIndex = ORDER.indexOf(maximumQuality);
    if (currentIndex < maximumIndex) setQuality(ORDER[currentIndex + 1]);
  }

  return quality;
}

export function subscribeRenderingQuality(listener: QualityListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
