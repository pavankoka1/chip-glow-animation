"use client";

import { useEffect, useRef, useState } from "react";

export default function useFps({ sampleSize = 60, continuous = false } = {}) {
  const [fps, setFps] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("fps");
      const parsed = stored ? parseFloat(stored) : NaN;
      return Number.isFinite(parsed) ? parsed : 60;
    }
    return 60;
  });
  const timesRef = useRef([]);
  const lastTsRef = useRef(null);
  const startTsRef = useRef(null);
  const rafRef = useRef(null);
  const doneRef = useRef(false);
  const updateIntervalRef = useRef(null);

  useEffect(() => {
    if (!continuous && doneRef.current) return;

    function tick(ts) {
      if (startTsRef.current == null) startTsRef.current = ts;
      if (lastTsRef.current != null) {
        const dt = ts - lastTsRef.current;
        if (dt > 0) {
          const instFps = 1000 / dt;
          timesRef.current.push(instFps);
          if (timesRef.current.length > sampleSize) timesRef.current.shift();

          if (continuous) {
            if (timesRef.current.length >= Math.max(10, sampleSize / 2)) {
              const avg =
                timesRef.current.reduce((a, b) => a + b, 0) /
                timesRef.current.length;
              const smooth = Math.round(avg * 10) / 10;
              setFps(smooth);
            }
          } else {
            const elapsed = (ts - startTsRef.current) / 1000;
            if (
              elapsed >= 1 &&
              timesRef.current.length >= Math.max(10, sampleSize / 2)
            ) {
              const avg =
                timesRef.current.reduce((a, b) => a + b, 0) /
                timesRef.current.length;
              const smooth = Math.round(avg * 10) / 10;
              doneRef.current = true;
              setFps(smooth);
              try {
                sessionStorage.setItem("fps", String(smooth));
              } catch {}
              if (rafRef.current) cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
              return;
            }
          }
        }
      }
      lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    if (continuous) {
      updateIntervalRef.current = setInterval(() => {
        if (timesRef.current.length > 0) {
          try {
            const avg =
              timesRef.current.reduce((a, b) => a + b, 0) /
              timesRef.current.length;
            const smooth = Math.round(avg * 10) / 10;
            sessionStorage.setItem("fps", String(smooth));
          } catch {}
        }
      }, 2000);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [sampleSize, continuous]);

  return fps;
}
