import * as THREE from "three";
import type { SceneModule } from "@movie/types/scene";
import { CinematicStage, ensureThree } from "@movie/lib/three/CinematicStage";
import { bigImpact, startAmbient, startScore } from "@movie/lib/audio/SoundDesign";
import { scene } from "./config";
import script from "./scene.md?raw";
import "./styles.css";

/**
 * Scene 04 — The Garden. 3D split-depth edition.
 *
 * Two Three.js stages mount side-by-side inside the scene root.
 * Left half — algorithmic hell: red point lights, notification cards
 * stacking as red-tinted boxes that pop and shake, a hovering "eye"
 * sphere that pulses.
 *
 * Right half — curated garden: low-poly flowers (cones with sphere heads)
 * blooming in sequence, a soft sun sphere, and a bee made of small
 * spheres drifting lazily.
 */

function createScene(): SceneModule {
  let left: CinematicStage | null = null;
  let right: CinematicStage | null = null;
  const stops: (() => void)[] = [];

  function buildHell(host: HTMLElement): CinematicStage {
    const s = new CinematicStage(host, {
      fov: 38,
      bloom: 0.7,
      background: 0x180203,
      fog: 0x180203,
      exposure: 0.95,
    });
    s.keyLight.color.set(0xff4040);
    s.keyLight.intensity = 0.6;
    s.rimLight.color.set(0x6e0000);
    s.rimLight.intensity = 0.6;
    s.ambient.color.set(0x220000);
    s.ambient.intensity = 0.35;

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x100, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    s.scene.add(floor);

    // Notification cards: instanced boxes at varying rotations.
    const cardGeo = new THREE.BoxGeometry(1.4, 0.2, 0.9);
    const cardMat = new THREE.MeshStandardMaterial({
      color: 0xff2030,
      emissive: 0x4a0008,
      emissiveIntensity: 0.7,
    });
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(cardGeo, cardMat);
      m.position.set(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.2) * 4,
        (Math.random() - 0.5) * 3 - 1,
      );
      m.rotation.set(
        Math.random() * 0.8 - 0.4,
        Math.random() * 0.8 - 0.4,
        Math.random() * 0.4 - 0.2,
      );
      s.scene.add(m);
    }

    // Pulsing eye
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 18),
      new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff3333,
        emissiveIntensity: 1.3,
      }),
    );
    eye.position.set(0, 1.2, -3);
    s.scene.add(eye);
    (s as unknown as { _hellEye: THREE.Mesh })._hellEye = eye;

    // Counter beacon: a tall thin red shaft that grows.
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff5050 }),
    );
    beacon.position.set(0, 5, -8);
    s.scene.add(beacon);

    s.camera.position.set(0, 1.0, 5.0);
    s.camera.lookAt(0, 0, -3);
    s.start();
    return s;
  }

  function buildGarden(host: HTMLElement): CinematicStage {
    const s = new CinematicStage(host, {
      fov: 34,
      bloom: 0.4,
      background: 0x9bd6ff,
      fog: 0xc5e2ff,
      exposure: 1.1,
    });
    s.keyLight.color.set(0xfff0c4);
    s.keyLight.intensity = 1.4;
    s.keyLight.position.set(3, 5, 2);
    s.rimLight.color.set(0x88c4ff);
    s.rimLight.intensity = 0.4;
    s.ambient.color.set(0x88b4d4);
    s.ambient.intensity = 0.6;

    // Sun
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 32, 20),
      new THREE.MeshBasicMaterial({ color: 0xffd56b }),
    );
    sun.position.set(-3, 3.5, -5);
    s.scene.add(sun);

    // Ground (grass)
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x6bbf51, roughness: 0.9 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.4;
    s.scene.add(grass);

    // Flowers: store refs for the bloom-in animation.
    const flowers: THREE.Group[] = [];
    for (let i = 0; i < 14; i++) {
      const cx = (Math.random() - 0.5) * 6;
      const cz = -Math.abs(Math.random() * 5) + 1;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x356b2c }),
      );
      stem.position.set(cx, -0.1, cz);
      const headColors = [0xff85a2, 0xffd56b, 0xc792ea, 0x82aaff];
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 16, 12),
        new THREE.MeshStandardMaterial({
          color: headColors[i % headColors.length],
          emissive: headColors[i % headColors.length],
          emissiveIntensity: 0.3,
        }),
      );
      head.position.y = 0.3;
      const grp = new THREE.Group();
      grp.add(stem, head);
      grp.position.set(cx, 0, cz);
      grp.scale.set(0.001, 0.001, 0.001);
      s.scene.add(grp);
      flowers.push(grp);
    }

    // Bee
    const bee = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0x222200, emissive: 0xffaa00, emissiveIntensity: 0.5 }),
    );
    bee.add(body);
    const wingL = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    wingL.rotation.z = -0.3;
    wingL.position.set(-0.1, 0.05, 0);
    const wingR = wingL.clone();
    wingR.position.x = 0.1;
    wingR.rotation.z = 0.3;
    bee.add(wingL, wingR);
    bee.position.set(0, 1, 0);
    s.scene.add(bee);

    s.camera.position.set(0, 0.8, 4);
    s.camera.lookAt(0, 0.4, 0);
    s.start();

    (s as unknown as { _gardenFlowers: THREE.Group[] })._gardenFlowers = flowers;
    (s as unknown as { _gardenBee: THREE.Group })._gardenBee = bee;
    return s;
  }

  const module: SceneModule = {
    config: scene,
    script,

    async preload() {
      await ensureThree();
    },

    create(rootEl) {
      rootEl.innerHTML = `
        <div class="garden-left"></div>
        <div class="garden-right"></div>
        <div class="garden-caption garden-caption--left">
          <span class="kicker">算法地狱</span>
          <strong>通知、推荐、红点，把注意力切成碎片</strong>
          <span class="garden-meter">ALERTS 128 · FOCUS 12%</span>
        </div>
        <div class="garden-caption garden-caption--right">
          <span class="kicker">手工花园</span>
          <strong>把订阅、代码、笔记修成可呼吸的秩序</strong>
          <span class="garden-meter">SIGNALS 9 · FOCUS 91%</span>
        </div>
      `;
      const leftHost = rootEl.querySelector(".garden-left") as HTMLElement;
      const rightHost = rootEl.querySelector(".garden-right") as HTMLElement;
      left = buildHell(leftHost);
      right = buildGarden(rightHost);

      // Audio: warm ambient on right, soft rumble via the digital drone.
      // The split visually feels like the rumble through a wall, hence we
      // start one shared ambient and bias volume on destroy side.
      stops.push(startAmbient("warm", 0.08));
      stops.push(startScore("garden", 0.04));
    },

    async warmup() {
      await Promise.all([left?.warmup(5), right?.warmup(5)].filter(Boolean));
    },

    play(tl) {
      if (!left || !right) return;
      const leftCaption = (left.renderer.domElement.parentElement?.parentElement)
        ?.querySelector(".garden-caption--left") as HTMLElement | null;
      const rightCaption = (right.renderer.domElement.parentElement?.parentElement)
        ?.querySelector(".garden-caption--right") as HTMLElement | null;
      if (leftCaption) {
        tl.fromTo(leftCaption, { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.7 }, 2.0);
        tl.to(leftCaption, { opacity: 0.72, duration: 0.7, yoyo: true, repeat: 8 }, 4.2);
      }
      if (rightCaption) {
        tl.fromTo(rightCaption, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.7 }, 2.4);
        tl.to(rightCaption, { opacity: 0.86, duration: 1.2, yoyo: true, repeat: 5 }, 5.0);
      }

      // ── HELL SIDE ──
      const eye = (left as unknown as { _hellEye: THREE.Mesh })._hellEye;
      tl.to(
        eye.scale,
        { x: 1.4, y: 1.4, z: 1.4, duration: 1.0, yoyo: true, repeat: Math.ceil(scene.duration / 2) },
        0,
      );

      // Notification cards pop in. We mutate all the cards we can find.
      const cards: THREE.Mesh[] = [];
      left.scene.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry?.type === "BoxGeometry") {
          cards.push(mesh);
        }
      });
      cards.forEach((c, i) => {
        const t = 1.0 + i * 0.18;
        tl.fromTo(
          c.position,
          { y: -2 },
          { y: c.position.y, duration: 0.5, ease: "power3.out" },
          t,
        );
        tl.to(c.rotation, { z: "+=0.3", duration: 0.4, yoyo: true, repeat: 6 }, t);
      });

      // Random impacts at intervals to give the hell side a heartbeat.
      for (let i = 0; i < 5; i++) {
        const t = 3.0 + i * 2.4;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tl as any).call(() => bigImpact(), [], t);
      }

      // Camera (hell) — slow inward push.
      tl.fromTo(
        left.camera.position,
        { x: 0, y: 1.0, z: 5.0 },
        { x: 0.3, y: 1.0, z: 3.8, duration: scene.duration, ease: "sine.inOut" },
        0,
      );

      // ── GARDEN SIDE ──
      const flowers = (right as unknown as { _gardenFlowers: THREE.Group[] })._gardenFlowers;
      flowers.forEach((f, i) => {
        const tBloom = 2.0 + i * 0.45;
        tl.fromTo(
          f.scale,
          { x: 0.001, y: 0.001, z: 0.001 },
          { x: 1, y: 1, z: 1, duration: 0.9, ease: "back.out(1.4)" },
          tBloom,
        );
      });

      // Bee: lazy figure-8.
      const bee = (right as unknown as { _gardenBee: THREE.Group })._gardenBee;
      tl.fromTo(bee.position, { x: -3, y: 0.5, z: 0.5 }, { x: 0, y: 1.0, z: 0, duration: 4, ease: "sine.inOut" }, 5);
      tl.to(bee.position, { x: 2, y: 1.4, z: -0.5, duration: 4, ease: "sine.inOut" }, 9);
      tl.to(bee.position, { x: -2, y: 0.8, z: -1, duration: 4, ease: "sine.inOut" }, 13);

      // Camera (garden) — same slow push.
      tl.fromTo(
        right.camera.position,
        { x: 0, y: 0.8, z: 4 },
        { x: -0.4, y: 0.7, z: 3.0, duration: scene.duration, ease: "sine.inOut" },
        0,
      );
      tl.fromTo(right.camera, { fov: 34 }, { fov: 30, duration: scene.duration }, 0);

      // Hold.
      tl.to({} as object, { duration: 0.6 }, scene.duration - 0.7);
    },

    pause() {},

    destroy() {
      while (stops.length) stops.pop()!();
      if (left) { left.dispose(); left = null; }
      if (right) { right.dispose(); right = null; }
    },
  };

  return module;
}

export default createScene();
