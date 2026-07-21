import gsap from "gsap";

/**
 * Thin wrapper around a GSAP timeline that enforces a single source of
 * time per scene. No setTimeout anywhere — all motion goes through here.
 */
export class Timeline {
  private tl: gsap.core.Timeline;

  constructor() {
    this.tl = gsap.timeline({ paused: true });
  }

  get gsapTimeline(): gsap.core.Timeline {
    return this.tl;
  }

  play(): void {
    this.tl.play();
  }

  pause(): void {
    this.tl.pause();
  }

  seek(time: number): void {
    this.tl.seek(time);
  }

  duration(): number {
    return this.tl.duration();
  }

  clear(): void {
    this.tl.pause(0);
    this.tl.clear();
    this.tl.pause(0);
  }

  kill(): void {
    this.tl.kill();
  }
}
