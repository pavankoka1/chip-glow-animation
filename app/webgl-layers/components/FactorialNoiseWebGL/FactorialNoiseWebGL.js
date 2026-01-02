"use client";

import { useEffect, useRef } from "react";
import FactorialNoiseCanvas from "../../../components/FactorialNoiseCanvas";

export default function FactorialNoiseWebGL({
  anchorEl,
  pathConfig,
  isPlaying = false,
  globalConfig = {},
}) {
  const containerRef = useRef(null);
  const animationIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  
  // Cache style values to avoid redundant DOM updates
  const styleCacheRef = useRef({
    opacity: null,
    borderRadius: null,
    overflow: null,
  });

  // Find SVG animation config to sync timing
  const svgPathConfig = globalConfig.paths?.find(
    (p) => p.type === "svg" && p.enabled !== false
  );

  // Update refs when props change
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      startTimeRef.current = performance.now();
    } else {
      startTimeRef.current = null;
      // Reset opacity and border radius when stopped
      if (containerRef.current) {
        containerRef.current.style.opacity = "0";
        containerRef.current.style.borderRadius = "";
        containerRef.current.style.overflow = "";
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!containerRef.current || !anchorEl) return;

    const containerElement = containerRef.current;
    const merged = {
      delay: pathConfig.delay || 0,
      animationTimeMs: pathConfig.animationTimeMs || 420,
    };

    // SVG animation timing for sync - pre-calculate once
    const svgDelay = svgPathConfig?.delay || 540;
    const svgDuration = svgPathConfig?.animationTimeMs || 1000;
    const svgDelaySec = svgDelay / 1000;
    const svgDurationSec = svgDuration / 1000;
    const svgFadeOutStart = svgDelaySec + svgDurationSec / 2; // Start of second half
    const svgFadeOutEnd = svgDelaySec + svgDurationSec; // End of SVG animation
    const delaySec = merged.delay / 1000;
    const durationSec = merged.animationTimeMs / 1000;

    const styleCache = styleCacheRef.current;

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      // Early exit if not playing
      if (!isPlayingRef.current || !startTimeRef.current) {
        return;
      }

      const now = performance.now();
      const elapsed = (now - startTimeRef.current) / 1000;

      // Early exit if in delay period
      if (elapsed < delaySec) {
        // Only update if values changed
        if (styleCache.opacity !== "0") {
          containerElement.style.opacity = "0";
          styleCache.opacity = "0";
        }
        if (styleCache.borderRadius !== "") {
          containerElement.style.borderRadius = "";
          styleCache.borderRadius = "";
        }
        if (styleCache.overflow !== "") {
          containerElement.style.overflow = "";
          styleCache.overflow = "";
        }
        return;
      }

      // Calculate animation elapsed time (after delay)
      const animationElapsed = Math.max(0, elapsed - delaySec);

      // Check if SVG animation is active
      const isSvgActive = elapsed >= svgDelaySec && elapsed < svgFadeOutEnd;
      const isSvgFadingOut = elapsed >= svgFadeOutStart && elapsed < svgFadeOutEnd;
      const isAfterSvgComplete = elapsed >= svgFadeOutEnd;

      // Calculate opacity based on animation progress
      let opacity = 0;

      if (isAfterSvgComplete) {
        // After SVG animation completes: stay at 0 opacity (never reappear)
        opacity = 0;
      } else if (animationElapsed >= 0 && animationElapsed < durationSec) {
        // Fade in from 0 to 1 over the duration
        opacity = Math.min(1, animationElapsed / durationSec);
      } else if (animationElapsed >= durationSec) {
        // After fade in complete: stay at full opacity until SVG starts fading
        if (isSvgFadingOut) {
          // Fade out in sync with SVG (second half of SVG animation)
          const fadeOutProgress =
            (elapsed - svgFadeOutStart) / (svgFadeOutEnd - svgFadeOutStart);
          opacity = Math.max(0, 1 - fadeOutProgress);
        } else if (isSvgActive) {
          // SVG is active but not fading yet: stay at full opacity
          opacity = 1;
        } else {
          // Before SVG starts: stay at full opacity
          opacity = 1;
        }
      }

      // Convert opacity to string for comparison
      const opacityStr = opacity.toString();

      // Only update opacity if it changed
      if (styleCache.opacity !== opacityStr) {
        containerElement.style.opacity = opacityStr;
        styleCache.opacity = opacityStr;
      }

      // Apply border radius when SVG is active (same as SVG animation)
      const borderRadius = isSvgActive ? "6.75px" : "";
      const overflow = isSvgActive ? "hidden" : "";

      // Only update if values changed
      if (styleCache.borderRadius !== borderRadius) {
        containerElement.style.borderRadius = borderRadius;
        styleCache.borderRadius = borderRadius;
      }

      if (styleCache.overflow !== overflow) {
        containerElement.style.overflow = overflow;
        styleCache.overflow = overflow;
      }
    };

    animationIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [anchorEl, pathConfig, isPlaying, svgPathConfig]);

  if (!anchorEl) return null;

  // Get betspot dimensions
  const width = anchorEl.offsetWidth || 43;
  const height = anchorEl.offsetHeight || 46;

  return (
    <div
      ref={containerRef}
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        opacity: 0,
        zIndex: 1, // Below other animations (they use higher z-index)
      }}
    >
      <FactorialNoiseCanvas width={width} height={height} />
    </div>
  );
}

