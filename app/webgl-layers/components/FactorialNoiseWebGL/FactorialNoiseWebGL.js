"use client";

import { useEffect, useRef, useState } from "react";
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
  const [dimensions, setDimensions] = useState({ width: 43, height: 46 });
  
  // Cache style values to avoid redundant DOM updates
  const styleCacheRef = useRef({
    opacity: null,
    borderRadius: null,
    overflow: null,
  });

  // Get SVG animation config to sync scaling
  const svgPathConfig = globalConfig.paths?.find(
    (p) => p.type === "svg" && p.enabled !== false
  );

  // Update dimensions when anchor element changes
  useEffect(() => {
    const element = anchorEl?.current || anchorEl;
    if (!element) return;

    const updateDimensions = () => {
      if (element) {
        try {
          // Get base dimensions (unscaled)
          const width = element.offsetWidth || 0;
          const height = element.offsetHeight || 0;

          if (width > 0 && height > 0) {
            setDimensions({ width, height });
          }
        } catch (error) {
          // Silently handle errors
        }
      }
    };

    // Initial update
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        updateDimensions();
      });
    }
  }, [anchorEl]);

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
    const element = anchorEl?.current || anchorEl;
    const merged = {
      delay: pathConfig.delay || 0,
      animationTimeMs: pathConfig.animationTimeMs || 420,
    };

    // Get SVG animation timing to calculate scale
    const svgDelay = svgPathConfig?.delay || 540;
    const svgDuration = svgPathConfig?.animationTimeMs || 1000;
    const svgMaxScale = svgPathConfig?.maxScale || 1.1;
    const svgDelaySec = svgDelay / 1000;
    const svgDurationSec = svgDuration / 1000;
    const maxScaleDiff = svgMaxScale - 1.0;

    // Independent timing - use own animation duration
    // animationTimeMs represents how long it stays visible at full opacity
    // Quick fades are added before and after
    const delaySec = merged.delay / 1000;
    const visibleDurationSec = merged.animationTimeMs / 1000; // Time at full opacity
    const fadeInDurationSec = 0.08; // Quick fade in (80ms)
    const fadeOutDurationSec = 0.12; // Quick fade out (120ms)
    const fadeInEndTime = delaySec + fadeInDurationSec;
    const fadeOutStartTime = delaySec + fadeInDurationSec + visibleDurationSec;
    const animationEndTime = delaySec + fadeInDurationSec + visibleDurationSec + fadeOutDurationSec;

    const styleCache = styleCacheRef.current;

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      // Early exit if not playing
      if (!isPlayingRef.current || !startTimeRef.current) {
        return;
      }

      const now = performance.now();
      const elapsed = (now - startTimeRef.current) / 1000;

      // Calculate scale from SVG animation (same logic as SvgAnimationWebGL)
      let currentScale = 1.0;
      if (svgPathConfig && element) {
        const svgElapsed = Math.max(0, elapsed - svgDelaySec);
        if (svgElapsed >= 0 && svgElapsed < svgDurationSec) {
          const progress = svgElapsed / svgDurationSec;
          if (progress < 0.5) {
            // First half: scale up from 1.0 to maxScale
            currentScale = 1.0 + maxScaleDiff * (progress * 2);
          } else {
            // Second half: scale down from maxScale to 1.0
            currentScale = svgMaxScale - maxScaleDiff * ((progress - 0.5) * 2);
          }
        } else if (svgElapsed >= svgDurationSec) {
          currentScale = 1.0;
        }
      }

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

      // Calculate opacity based on independent animation timing
      let opacity = 0;

      if (elapsed < fadeInEndTime) {
        // Fade in phase
        const fadeInProgress = (elapsed - delaySec) / fadeInDurationSec;
        opacity = Math.max(0, Math.min(1, fadeInProgress));
      } else if (elapsed >= fadeInEndTime && elapsed < fadeOutStartTime) {
        // Full opacity phase
        opacity = 1;
      } else if (elapsed >= fadeOutStartTime && elapsed < animationEndTime) {
        // Fade out phase
        const fadeOutProgress = (elapsed - fadeOutStartTime) / fadeOutDurationSec;
        opacity = Math.max(0, 1 - fadeOutProgress);
      } else {
        // After animation completes: stay at 0 opacity
        opacity = 0;
      }

      // Convert opacity to string for comparison
      const opacityStr = opacity.toString();

      // Only update opacity if it changed
      if (styleCache.opacity !== opacityStr) {
        containerElement.style.opacity = opacityStr;
        styleCache.opacity = opacityStr;
      }

      // Apply border radius during animation (independent of SVG)
      const isAnimationActive = elapsed >= delaySec && elapsed < animationEndTime;
      const borderRadius = isAnimationActive ? "6.75px" : "";
      const overflow = isAnimationActive ? "hidden" : "";

      // Apply scale transform to match betspot scaling
      const transform = `scale(${currentScale}) translateZ(0)`;
      if (containerElement.style.transform !== transform) {
        containerElement.style.transform = transform;
        containerElement.style.transformOrigin = "center center";
      }

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

  const { width, height } = dimensions;

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

