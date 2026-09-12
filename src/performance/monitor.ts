import {
  getRenderingQuality,
  observeFrameRate,
  type RenderingQuality,
} from "@movie/lib/three/quality";

interface LargestContentfulPaintEntry extends PerformanceEntry {
  renderTime: number;
  loadTime: number;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface EventTimingEntry extends PerformanceEntry {
  duration: number;
  interactionId: number;
}

export interface PerformanceSnapshot {
  ttfb: number;
  fcp: number;
  lcp: number;
  cls: number;
  inp: number;
  longTaskCount: number;
  longTaskTotal: number;
  longTaskMax: number;
  fps: number;
  quality: RenderingQuality;
}

declare global {
  interface Window {
    __NAVYDEV_PERFORMANCE__?: PerformanceSnapshot;
  }
}

const snapshot: PerformanceSnapshot = {
  ttfb: 0,
  fcp: 0,
  lcp: 0,
  cls: 0,
  inp: 0,
  longTaskCount: 0,
  longTaskTotal: 0,
  longTaskMax: 0,
  fps: 0,
  quality: getRenderingQuality(),
};

function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function publishSnapshot(): void {
  snapshot.quality = getRenderingQuality();
  window.__NAVYDEV_PERFORMANCE__ = { ...snapshot };
}

function observe(
  type: string,
  callback: (entries: PerformanceEntry[]) => void,
): PerformanceObserver | null {
  if (!window.PerformanceObserver) return null;
  if (!PerformanceObserver.supportedEntryTypes.includes(type)) return null;

  const observer = new PerformanceObserver((list) => callback(list.getEntries()));
  observer.observe({ type, buffered: true });
  return observer;
}

function report(reason: "settled" | "hidden" | "pagehide"): void {
  publishSnapshot();
  if (
    !import.meta.env.PROD ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
  ) {
    return;
  }

  const connection = navigator as Navigator & {
    connection?: { effectiveType?: string };
  };
  const params = new URLSearchParams({
    reason,
    ttfb: String(round(snapshot.ttfb)),
    fcp: String(round(snapshot.fcp)),
    lcp: String(round(snapshot.lcp)),
    cls: String(round(snapshot.cls, 3)),
    inp: String(round(snapshot.inp)),
    ltc: String(snapshot.longTaskCount),
    ltt: String(round(snapshot.longTaskTotal)),
    ltm: String(round(snapshot.longTaskMax)),
    fps: String(round(snapshot.fps, 1)),
    quality: snapshot.quality,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    dpr: String(round(window.devicePixelRatio, 2)),
    network: connection.connection?.effectiveType ?? "unknown",
  });

  void fetch(`/__perf.gif?${params}`, {
    cache: "no-store",
    credentials: "omit",
    keepalive: true,
  }).catch(() => undefined);
}

export function startPerformanceMonitor(): () => void {
  const observers: PerformanceObserver[] = [];
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  snapshot.ttfb = navigation?.responseStart ?? 0;

  const paintObserver = observe("paint", (entries) => {
    const fcp = entries.find((entry) => entry.name === "first-contentful-paint");
    if (fcp) snapshot.fcp = fcp.startTime;
    publishSnapshot();
  });
  if (paintObserver) observers.push(paintObserver);

  const lcpObserver = observe("largest-contentful-paint", (entries) => {
    const latest = entries.at(-1) as LargestContentfulPaintEntry | undefined;
    if (latest) snapshot.lcp = latest.renderTime || latest.loadTime || latest.startTime;
    publishSnapshot();
  });
  if (lcpObserver) observers.push(lcpObserver);

  const clsObserver = observe("layout-shift", (entries) => {
    entries.forEach((entry) => {
      const shift = entry as LayoutShiftEntry;
      if (!shift.hadRecentInput) snapshot.cls += shift.value;
    });
    publishSnapshot();
  });
  if (clsObserver) observers.push(clsObserver);

  const eventObserver = observe("event", (entries) => {
    entries.forEach((entry) => {
      const event = entry as EventTimingEntry;
      if (event.interactionId > 0) snapshot.inp = Math.max(snapshot.inp, event.duration);
    });
    publishSnapshot();
  });
  if (eventObserver) observers.push(eventObserver);

  const longTaskObserver = observe("longtask", (entries) => {
    entries.forEach((entry) => {
      snapshot.longTaskCount += 1;
      snapshot.longTaskTotal += entry.duration;
      snapshot.longTaskMax = Math.max(snapshot.longTaskMax, entry.duration);
    });
    publishSnapshot();
  });
  if (longTaskObserver) observers.push(longTaskObserver);

  let animationFrame = 0;
  let sampleStarted = performance.now();
  let sampleFrames = 0;
  const recentFps: number[] = [];
  const sample = (now: number) => {
    if (document.hidden) {
      sampleStarted = now;
      sampleFrames = 0;
    } else {
      sampleFrames += 1;
      const elapsed = now - sampleStarted;
      if (elapsed >= 2000) {
        const fps = (sampleFrames * 1000) / elapsed;
        recentFps.push(fps);
        if (recentFps.length > 5) recentFps.shift();
        snapshot.fps = recentFps.reduce((sum, value) => sum + value, 0) / recentFps.length;
        observeFrameRate(fps);
        publishSnapshot();
        sampleStarted = now;
        sampleFrames = 0;
      }
    }
    animationFrame = window.requestAnimationFrame(sample);
  };
  animationFrame = window.requestAnimationFrame(sample);

  const settledTimer = window.setTimeout(() => report("settled"), 15000);
  const onVisibilityChange = () => {
    if (document.hidden) report("hidden");
  };
  const onPageHide = () => report("pagehide");
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  publishSnapshot();

  return () => {
    observers.forEach((observer) => observer.disconnect());
    window.cancelAnimationFrame(animationFrame);
    window.clearTimeout(settledTimer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
  };
}
