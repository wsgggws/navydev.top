import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import reel from "@movie/movie";
import { MovieDirector } from "@movie/director";
import type { MovieDirectorError } from "@movie/director/MovieDirector";
import { mountTitleCard } from "@movie/lib/transition";
import { prefersReducedMotion, watchReducedMotion } from "@movie/lib/motion";
import { prewarmReel } from "@movie/prewarm";

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const directorRef = useRef<MovieDirector | null>(null);
  const reducedMotionRef = useRef(prefersReducedMotion());
  const controlsTimerRef = useRef<number | null>(null);
  const [armed, setArmed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playbackError, setPlaybackError] = useState<MovieDirectorError | null>(null);

  const revealControls = () => {
    if (!armed || playbackError) return;
    setControlsVisible(true);
    if (controlsTimerRef.current !== null) {
      window.clearTimeout(controlsTimerRef.current);
    }
    if (playing) {
      controlsTimerRef.current = window.setTimeout(() => {
        controlsTimerRef.current = null;
        setControlsVisible(false);
      }, 3000);
    }
  };

  const holdControlsForFocus = () => {
    if (!armed || playbackError) return;
    setControlsVisible(true);
    if (controlsTimerRef.current !== null) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!armed || !stageRef.current) return;
    const director = new MovieDirector(stageRef.current, reel, {
      reducedMotion: reducedMotionRef.current,
    });
    directorRef.current = director;
    const titleCard = mountTitleCard(stageRef.current);
    director.setOnState((state) => {
      setPlaybackError(null);
      setCurrentIndex(state.index);
      setSceneProgress(0);
      setPlaying(true);
      titleCard.show(
        state.config,
        `${String(state.index + 1).padStart(2, "0")} / ${String(reel.length).padStart(2, "0")}`,
      );
    });
    director.setOnProgress((state) => {
      setCurrentIndex(state.index);
      setSceneProgress(state.progress);
    });
    director.setOnError((failure) => {
      setPlaybackError(failure);
      setPlaying(false);
      setControlsVisible(false);
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
    if (controlsTimerRef.current !== null) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
    if (playbackError) {
      setControlsVisible(false);
      return;
    }
    if (!armed || !playing) {
      setControlsVisible(true);
      return;
    }

    controlsTimerRef.current = window.setTimeout(() => {
      controlsTimerRef.current = null;
      setControlsVisible(false);
    }, 3000);

    return () => {
      if (controlsTimerRef.current !== null) {
        window.clearTimeout(controlsTimerRef.current);
        controlsTimerRef.current = null;
      }
    };
  }, [armed, playbackError, playing]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    directorRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    let cancelled = false;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    const warmup = prewarmReel(reel);

    void Promise.all([wait(1200), Promise.race([warmup, wait(1800)])]).then(
      () => {
        if (!cancelled) setArmed(true);
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

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

      if (event.key === " ") {
        event.preventDefault();
        setControlsVisible(true);
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
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [armed]);

  return (
    <main
      className="stage-host"
      data-armed={armed ? "true" : "false"}
      data-controls-visible={controlsVisible ? "true" : "false"}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      onFocusCapture={holdControlsForFocus}
      onBlurCapture={revealControls}
    >
      <div className="stage-frame">
        <div ref={stageRef} className="stage" />
      </div>
      {!armed && (
        <div className="start-overlay" aria-live="polite">
          <div className="start-prologue">
            <strong>生活就是自导自演的一场戏</strong>
          </div>
        </div>
      )}
      {playbackError && (
        <section className="error-overlay" role="alert" aria-live="assertive">
          <span>REEL INTERRUPTED</span>
          <h2>{playbackError.config?.title ?? "Scene unavailable"}</h2>
          <p>THE SCENE COULD NOT BE LOADED.</p>
          <button
            type="button"
            onClick={() => {
              if (playbackError.requiresReload) {
                window.location.reload();
                return;
              }
              setPlaybackError(null);
              setPlaying(true);
              directorRef.current?.retry(playbackError.index);
            }}
          >
            <RotateCcw aria-hidden="true" size={16} strokeWidth={1.8} />
            <span>RETRY</span>
          </button>
        </section>
      )}
      {armed && (
        <>
          <div className="chapter-rail" aria-label="Chapter progress">
            <div className="chapter-rail__meta">
              <span>
                {String(currentIndex + 1).padStart(2, "0")} / {String(reel.length).padStart(2, "0")}
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
                    onClick={() => {
                      directorRef.current?.goToScene(index);
                      setControlsVisible(false);
                    }}
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
              {playing ? (
                <Pause aria-hidden="true" size={16} strokeWidth={1.8} />
              ) : (
                <Play aria-hidden="true" size={16} strokeWidth={1.8} />
              )}
            </button>
            <button
              className="reel-control"
              type="button"
              aria-label="Replay current scene"
              title="Replay scene"
              onClick={() => {
                directorRef.current?.replay();
                setControlsVisible(false);
              }}
            >
              <RotateCcw aria-hidden="true" size={16} strokeWidth={1.8} />
            </button>
            <button
              className="reel-control"
              type="button"
              aria-label="Skip current scene"
              title="Skip scene"
              onClick={() => {
                directorRef.current?.skip();
                setControlsVisible(false);
              }}
            >
              <SkipForward aria-hidden="true" size={16} strokeWidth={1.8} />
            </button>
            <button
              className="reel-control"
              type="button"
              aria-label="Restart reel"
              title="Restart reel"
              onClick={() => {
                directorRef.current?.restart();
                setControlsVisible(false);
              }}
            >
              <RefreshCw aria-hidden="true" size={16} strokeWidth={1.8} />
            </button>
          </div>
        </>
      )}
    </main>
  );
}
