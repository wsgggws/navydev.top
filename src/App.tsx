import { useEffect, useRef, useState } from "react";
import reel from "@movie/movie";
import { MovieDirector } from "@movie/director";
import { mountTitleCard } from "@movie/lib/transition";
import { isMuted, primeAudio, toggleMuted } from "@movie/lib/audio/SoundDesign";
import { prefersReducedMotion, watchReducedMotion } from "@movie/lib/motion";
import { prewarmReel } from "@movie/prewarm";

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const directorRef = useRef<MovieDirector | null>(null);
  const reducedMotionRef = useRef(prefersReducedMotion());
  const prewarmRef = useRef<Promise<void> | null>(null);
  const autoRollRef = useRef(false);
  const [armed, setArmed] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [muted, setMuted] = useState(isMuted());
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [prewarmReady, setPrewarmReady] = useState(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!armed || !stageRef.current) return;
    const director = new MovieDirector(stageRef.current, reel, {
      reducedMotion: reducedMotionRef.current,
    });
    directorRef.current = director;
    const titleCard = mountTitleCard(stageRef.current);
    director.setOnState((state) => {
      setCurrentIndex(state.index);
      setSceneProgress(0);
      setPlaying(true);
      titleCard.show(
        state.config,
        `CHAPTER ${String(state.index + 1).padStart(2, "0")}`,
      );
    });
    director.setOnProgress((state) => {
      setCurrentIndex(state.index);
      setSceneProgress(state.progress);
    });
    void director.start();
    return () => {
      titleCard.dispose();
      void director.dispose();
      directorRef.current = null;
    };
  }, [armed]);

  useEffect(() => watchReducedMotion(setReducedMotion), []);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    directorRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    if (armed || !rolling) return;
    let cancelled = false;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    const warmup = prewarmRef.current ?? Promise.resolve();

    const timers = [
      window.setTimeout(() => setCountdown(2), 1000),
      window.setTimeout(() => setCountdown(1), 2000),
    ];

    void Promise.all([wait(3000), Promise.race([warmup, wait(5200)])]).then(
      () => {
        if (!cancelled) setArmed(true);
      },
    );

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [armed, rolling]);

  const roll = () => {
    if (rolling || armed) return;
    void primeAudio();
    setPrewarmReady(false);
    const prewarm = prewarmReel(reel).finally(() => setPrewarmReady(true));
    prewarmRef.current = prewarm;
    setRolling(true);
  };

  useEffect(() => {
    if (autoRollRef.current || rolling || armed) return;

    const timer = window.setTimeout(
      () => {
        if (autoRollRef.current) return;
        autoRollRef.current = true;
        roll();
      },
      reducedMotion ? 350 : 1150,
    );

    return () => window.clearTimeout(timer);
  }, [reducedMotion, rolling, armed]);

  const togglePlayback = () => {
    const director = directorRef.current;
    if (!director) return;
    if (director.isPlaying) {
      director.pause();
      setPlaying(false);
      return;
    }
    director.play();
    setPlaying(true);
  };

  useEffect(() => {
    if (!armed) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key.toLowerCase() === "m") {
        const next = toggleMuted();
        setMuted(next);
        if (!next) void primeAudio();
      }
      if (event.key === " ") {
        event.preventDefault();
        togglePlayback();
      }
      if (event.key.toLowerCase() === "r") directorRef.current?.replay();
      if (event.key.toLowerCase() === "s" || event.key === "ArrowRight")
        directorRef.current?.skip();
      if (event.key === "Home") directorRef.current?.restart();
      const chapter = Number(event.key);
      if (Number.isInteger(chapter) && chapter >= 1 && chapter <= reel.length) {
        directorRef.current?.goToScene(chapter - 1);
      }
      if (event.key === "0" && reel[9]) directorRef.current?.goToScene(9);
      if (event.key === "-" && reel[10]) directorRef.current?.goToScene(10);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [armed]);

  return (
    <main className="stage-host">
      <div className="stage-frame">
        <div ref={stageRef} className="stage" />
      </div>
      {!armed && (
        <div className="start-overlay" aria-live="polite">
          <span className="start-title">DIRECTOR</span>
          {rolling ? (
            <>
              <span key={countdown} className="start-count">
                {countdown}
              </span>
              <span className="start-sub">
                {prewarmReady
                  ? "PICTURE READY"
                  : "SOUND CHECK · PICTURE WARMUP"}
              </span>
            </>
          ) : (
            <div className="start-roll-scene">
              <button className="start-roll" type="button" onClick={roll}>
                ROLL
              </button>
              {!reducedMotion && (
                <span className="start-hand" aria-hidden="true" />
              )}
            </div>
          )}
        </div>
      )}
      {armed && (
        <>
          <div className="chapter-rail" aria-label="Chapter progress">
            <div className="chapter-rail__meta">
              <span>
                {reel[currentIndex]?.config.id
                  .toUpperCase()
                  .replace(/-/g, " · ")}
              </span>
              <strong>{reel[currentIndex]?.config.title}</strong>
            </div>
            <div className="chapter-rail__track">
              {reel.map((entry, index) => {
                const progress =
                  index < currentIndex
                    ? 1
                    : index === currentIndex
                      ? sceneProgress
                      : 0;
                return (
                  <button
                    key={entry.config.id}
                    className="chapter-rail__chapter"
                    type="button"
                    aria-label={`Go to ${entry.config.title}`}
                    aria-current={index === currentIndex ? "step" : undefined}
                    title={entry.config.title}
                    style={
                      { "--chapter-progress": progress } as React.CSSProperties
                    }
                    onClick={() => directorRef.current?.goToScene(index)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div
            className="reel-controls"
            aria-label="Reel controls"
            data-reduced-motion={reducedMotion ? "true" : "false"}
          >
            <button
              className="reel-control"
              type="button"
              aria-label={playing ? "Pause reel" : "Play reel"}
              title={playing ? "Pause" : "Play"}
              onClick={togglePlayback}
            >
              {playing ? "PAUSE" : "PLAY"}
            </button>
            <button
              className="reel-control"
              type="button"
              aria-label={muted ? "Unmute reel" : "Mute reel"}
              title={muted ? "Unmute" : "Mute"}
              onClick={() => {
                const next = toggleMuted();
                setMuted(next);
                if (!next) void primeAudio();
              }}
            >
              {muted ? "SOUND" : "MUTE"}
            </button>
            <button
              className="reel-control"
              type="button"
              aria-label="Replay current scene"
              title="Replay scene"
              onClick={() => directorRef.current?.replay()}
            >
              REPLAY
            </button>
            <button
              className="reel-control"
              type="button"
              aria-label="Skip current scene"
              title="Skip scene"
              onClick={() => directorRef.current?.skip()}
            >
              SKIP
            </button>
            <button
              className="reel-control"
              type="button"
              aria-label="Restart reel"
              title="Restart reel"
              onClick={() => directorRef.current?.restart()}
            >
              RESTART
            </button>
          </div>
        </>
      )}
    </main>
  );
}
