"use client";

import { useEffect, useRef } from "react";

export default function MultiplierWebGL({
  anchorEl,
  pathConfig,
  isPlaying = false,
  globalConfig = {},
}) {
  const multiplierRef = useRef(null);
  const animationIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);

  // Update refs when props change
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      startTimeRef.current = performance.now();
    } else {
      startTimeRef.current = null;
      // Reset multiplier when stopped
      if (multiplierRef.current) {
        multiplierRef.current.style.transform = "translate(-50%, -50%) scale(0) translateZ(0)";
        multiplierRef.current.style.opacity = "0";
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!multiplierRef.current || !anchorEl) return;

    const multiplierElement = multiplierRef.current;
    const merged = {
      delay: pathConfig.delay || 0,
      animationTimeMs: pathConfig.animationTimeMs || 1930,
      phase1Duration: pathConfig.phase1Duration || 210,
      phase2Duration: pathConfig.phase2Duration || 450,
      phase3Duration: pathConfig.phase3Duration || 850,
      phase4Duration: pathConfig.phase4Duration || 500,
      maxScale: pathConfig.maxScale || 1.2,
    };

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      if (!isPlayingRef.current || !startTimeRef.current) {
        return;
      }

      const now = performance.now();
      const elapsed = (now - startTimeRef.current) / 1000;
      const delaySec = merged.delay / 1000;
      const durationSec = merged.animationTimeMs / 1000;

      // Calculate animation elapsed time (after delay)
      const animationElapsed = Math.max(0, elapsed - delaySec);

      // Check if we're in delay period
      const isInDelayPeriod = elapsed < delaySec;

      if (isInDelayPeriod) {
        // In delay period: hide multiplier
        multiplierElement.style.opacity = "0";
        multiplierElement.style.transform = "translate(-50%, -50%) scale(0) translateZ(0)";
        return;
      }

      // Phase calculations
      const PHASE1_DURATION = merged.phase1Duration / 1000;
      const PHASE2_DURATION = merged.phase2Duration / 1000;
      const PHASE3_DURATION = merged.phase3Duration / 1000;
      const PHASE4_DURATION = merged.phase4Duration / 1000;

      const phase1Start = 0;
      const phase2Start = phase1Start + PHASE1_DURATION;
      const phase3Start = phase2Start + PHASE2_DURATION;
      const phase4Start = phase3Start + PHASE3_DURATION;

      let scale = 0;
      let opacity = 0;

      if (animationElapsed < 0 || animationElapsed >= durationSec) {
        // Before or after animation
        scale = 0;
        opacity = 0;
      } else if (animationElapsed < phase2Start) {
        // Phase 1: Scale up from 0 to maxScale, opacity from 0 to 1
        const phase1Progress = Math.min(1, Math.max(0, animationElapsed / PHASE1_DURATION));
        scale = 0 + (merged.maxScale - 0) * phase1Progress;
        opacity = 0 + (1 - 0) * phase1Progress;
      } else if (animationElapsed < phase3Start) {
        // Phase 2: Scale down from maxScale to 1, opacity stays at 1
        const phase2Progress = Math.min(
          1,
          Math.max(0, (animationElapsed - phase2Start) / PHASE2_DURATION)
        );
        scale = merged.maxScale + (1 - merged.maxScale) * phase2Progress;
        opacity = 1;
      } else if (animationElapsed < phase4Start) {
        // Phase 3: Hold at scale 1, opacity 1
        scale = 1;
        opacity = 1;
      } else if (animationElapsed < phase4Start + PHASE4_DURATION) {
        // Phase 4: Scale down from 1 to 0, opacity from 1 to 0
        const phase4Progress = Math.min(
          1,
          Math.max(0, (animationElapsed - phase4Start) / PHASE4_DURATION)
        );
        scale = 1 + (0 - 1) * phase4Progress;
        opacity = 1 + (0 - 1) * phase4Progress;
      } else {
        // After animation
        scale = 0;
        opacity = 0;
      }

      multiplierElement.style.transform = `translate(-50%, -50%) scale(${scale}) translateZ(0)`;
      multiplierElement.style.opacity = `${opacity}`;
    };

    animate();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [anchorEl, pathConfig, isPlaying]);

  const text = pathConfig.text || "50x";

  return (
    <div
      ref={multiplierRef}
      data-multiplier-element="true"
      className="absolute flex items-center justify-center pointer-events-none"
      style={{
        transform: "translate(-50%, -50%) scale(0) translateZ(0)",
        opacity: "0",
        willChange: "transform, opacity",
        zIndex: 100,
        position: "absolute",
        top: "50%",
        left: "50%",
      }}
    >
      <span className="relative inline-block" style={{ lineHeight: 1 }}>
        {/* Border/Stroke layer - behind */}
        <span
          className="text-xl font-extrabold absolute"
          style={{
            left: 0,
            top: 0,
            color: "transparent",
            WebkitTextStroke: "6px #824905",
            textStroke: "6px #824905",
            whiteSpace: "nowrap",
            zIndex: 1,
          }}
        >
          {text}
        </span>
        {/* Gradient fill layer - on top */}
        <span
          className="text-xl font-extrabold relative"
          style={{
            background: "linear-gradient(to bottom, #feeda1, #f2f3ef, #feeda1)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            color: "#feeda1",
            display: "inline-block",
            whiteSpace: "nowrap",
            zIndex: 2,
          }}
        >
          {text}
        </span>
      </span>
    </div>
  );
}

