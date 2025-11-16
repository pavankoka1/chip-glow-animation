"use client";

import { useEffect, useRef, useState } from "react";

// Measures FPS once using requestAnimationFrame timestamps with rolling-average smoothing.
// - Ignores the first second for stability.
// - After computing the first stable FPS, stops measuring and stores the value in sessionStorage.
export default function useFps({ sampleSize = 60 } = {}) {
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

  useEffect(() => {
    if (doneRef.current) return; // already computed
    function tick(ts) {
      if (startTsRef.current == null) startTsRef.current = ts;
      if (lastTsRef.current != null) {
        const dt = ts - lastTsRef.current;
        if (dt > 0) {
          const instFps = 1000 / dt;
          timesRef.current.push(instFps);
          if (timesRef.current.length > sampleSize) timesRef.current.shift();
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
            // stop measuring after first stable value
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            return;
          }
        }
      }
      lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [sampleSize]);

  return fps;
}
