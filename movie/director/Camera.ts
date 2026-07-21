import gsap from "gsap";

/**
 * Camera abstraction. Today drives a CSS-transform-based "virtual" camera
 * over a target element. Later this can be swapped for a real Three.js
 * camera without touching scene code — scenes only see `pan`, `zoom`, etc.
 */
export class Camera {
  private target: HTMLElement | null = null;

  attach(target: HTMLElement): void {
    this.target = target;
    gsap.set(target, { transformOrigin: "50% 50%", scale: 1, x: 0, y: 0 });
  }

  detach(): void {
    this.target = null;
  }

  /**
   * Schedule a zoom on the camera's current timeline position.
   * Returns the tween so callers can place it in a parent timeline.
   */
  zoomTo(scale: number, duration: number, ease: string = "power2.inOut"): gsap.core.Tween {
    if (!this.target) throw new Error("Camera.zoomTo called before attach()");
    return gsap.to(this.target, { scale, duration, ease });
  }

  panTo(x: number, y: number, duration: number, ease: string = "power2.inOut"): gsap.core.Tween {
    if (!this.target) throw new Error("Camera.panTo called before attach()");
    return gsap.to(this.target, { x, y, duration, ease });
  }
}
