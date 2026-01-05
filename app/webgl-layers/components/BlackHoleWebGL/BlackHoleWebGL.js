"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function BlackHoleWebGL({
  anchorEl,
  pathConfig,
  isPlaying = false,
  globalConfig = {},
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const animationIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  const blackHoleGradientId = useId();
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 });

  // Cache style values to avoid redundant DOM updates
  const styleCacheRef = useRef({
    visibility: null,
    opacity: null,
    transform: null,
    borderRadius: null,
  });

  // Cache calculated values
  const calcCacheRef = useRef({
    scaleToCoverFull: null,
    dimensionsKey: null,
  });

  // Removed SVG sync - black hole now uses its own independent timing

  // Update refs when props change
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      startTimeRef.current = performance.now();
    } else {
      startTimeRef.current = null;
      // Reset SVG when stopped
      if (svgRef.current) {
        svgRef.current.style.opacity = "0";
        svgRef.current.style.transform = "scale(0)";
        svgRef.current.style.visibility = "hidden";
      }
    }
  }, [isPlaying]);

  // Update dimensions when anchor element changes
  useEffect(() => {
    const element = anchorEl?.current || anchorEl;
    if (!element) return;

    if (typeof element.getBoundingClientRect !== "function") {
      return;
    }

    const updateDimensions = () => {
      if (element) {
        try {
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

    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        updateDimensions();
      });
    }

    if (
      typeof window !== "undefined" &&
      typeof ResizeObserver !== "undefined"
    ) {
      const resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(element);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [anchorEl]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !anchorEl) return;

    const svgElement = svgRef.current;
    const containerElement = containerRef.current;
    const styleCache = styleCacheRef.current;
    const calcCache = calcCacheRef.current;

    const merged = {
      delay: pathConfig.delay || 660,
      phase1TimeMs: pathConfig.phase1TimeMs || 280, // Time to touch corners
      phase2TimeMs: pathConfig.phase2TimeMs || 50, // Time to cover full betspot
    };

    // Pre-calculate constants
    const delayMs = merged.delay;
    const phase1Ms = merged.phase1TimeMs;
    const phase2Ms = merged.phase2TimeMs;
    const totalPhaseMs = phase1Ms + phase2Ms;
    const totalDurationMs = delayMs + totalPhaseMs;

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      // Early exit if not playing
      if (!isPlayingRef.current || !startTimeRef.current) {
        return;
      }

      const now = performance.now();
      const elapsed = now - startTimeRef.current; // Already in milliseconds

      // Early exit if in delay period
      if (elapsed < delayMs) {
        // Only update if values changed
        if (styleCache.visibility !== "hidden") {
          svgElement.style.visibility = "hidden";
          styleCache.visibility = "hidden";
        }
        if (styleCache.opacity !== "0") {
          svgElement.style.opacity = "0";
          styleCache.opacity = "0";
        }
        if (styleCache.transform !== "scale(0) translateZ(0)") {
          svgElement.style.transform = "scale(0) translateZ(0)";
          styleCache.transform = "scale(0) translateZ(0)";
        }
        return;
      }

      // Calculate animation elapsed time (after delay)
      const animationElapsed = elapsed - delayMs;

      const { width, height } = dimensions;

      // Early exit if dimensions are invalid
      if (width === 0 || height === 0) {
        return;
      }

      // Cache scale calculation - only recalculate if dimensions changed
      const dimensionsKey = `${width}_${height}`;
      if (calcCache.dimensionsKey !== dimensionsKey) {
        const diagonal = Math.hypot(width, height);
        const maxDimension = Math.max(width, height);
        calcCache.scaleToCoverFull = maxDimension / (diagonal / 2);
        calcCache.dimensionsKey = dimensionsKey;
      }
      const scaleToCoverFull = calcCache.scaleToCoverFull;

      // Calculate scale: start at 0, reach 1 at corners, then cover full
      let currentScale = 0;

      if (animationElapsed < phase1Ms) {
        // Phase 1: Scale from 0 to 1 (touching corners)
        const phase1Progress = animationElapsed / phase1Ms;
        currentScale = phase1Progress; // Scale from 0 to 1
      } else if (animationElapsed < totalPhaseMs) {
        // Phase 2: Scale from 1 to cover full
        const phase2Progress = (animationElapsed - phase1Ms) / phase2Ms;
        currentScale = 1 + phase2Progress * (scaleToCoverFull - 1);
      } else {
        // Animation complete: keep at full scale
        currentScale = scaleToCoverFull;
      }

      // Calculate border radius: circular in phase 1, transition to betspot shape in phase 2
      const betspotBorderRadius = 6.75; // Same as betspot border radius
      const minDimension = Math.min(width, height);
      const circularBorderRadius = minDimension / 2; // Perfect circle
      let currentBorderRadius = circularBorderRadius;

      if (animationElapsed < phase1Ms) {
        // Phase 1: Keep circular (50% of min dimension)
        currentBorderRadius = circularBorderRadius;
      } else if (animationElapsed < totalPhaseMs) {
        // Phase 2: Transition from circular to betspot border radius
        const phase2Progress = (animationElapsed - phase1Ms) / phase2Ms;
        currentBorderRadius =
          circularBorderRadius +
          phase2Progress * (betspotBorderRadius - circularBorderRadius);
      } else {
        // Animation complete: use betspot border radius
        currentBorderRadius = betspotBorderRadius;
      }

      // Independent opacity: stay at full opacity during animation, fade out after completion
      let opacity = 1;
      const fadeOutDurationMs = 100; // Fade out duration after animation completes
      const fadeOutStartTime = totalDurationMs;
      const fadeOutEndTime = totalDurationMs + fadeOutDurationMs;

      if (elapsed >= fadeOutStartTime && elapsed < fadeOutEndTime) {
        // Fade out after animation completes
        const fadeProgress = (elapsed - fadeOutStartTime) / fadeOutDurationMs;
        opacity = Math.max(0, 1 - fadeProgress);
      } else if (elapsed >= fadeOutEndTime) {
        // Hide completely after fade out
        if (styleCache.visibility !== "hidden") {
          svgElement.style.visibility = "hidden";
          styleCache.visibility = "hidden";
        }
        if (styleCache.opacity !== "0") {
          svgElement.style.opacity = "0";
          styleCache.opacity = "0";
        }
        return;
      }

      // Show SVG once animation starts (past delay) - only update if changed
      if (styleCache.visibility !== "visible") {
        svgElement.style.visibility = "visible";
        styleCache.visibility = "visible";
      }

      // Apply opacity (only if changed)
      const opacityStr = opacity.toString();
      if (styleCache.opacity !== opacityStr) {
        svgElement.style.opacity = opacityStr;
        styleCache.opacity = opacityStr;
      }

      // Apply transform to SVG element (only if changed)
      const transform = `scale(${currentScale}) translateZ(0)`;
      if (styleCache.transform !== transform) {
        svgElement.style.transform = transform;
        svgElement.style.transformOrigin = "center center";
        styleCache.transform = transform;
      }

      // Apply border radius to container and SVG rect (only if changed)
      const borderRadiusStr = `${currentBorderRadius}px`;
      if (styleCache.borderRadius !== borderRadiusStr) {
        containerElement.style.borderRadius = borderRadiusStr;
        // Update SVG rect border radius
        const rectElement = svgElement.querySelector("rect");
        if (rectElement) {
          rectElement.setAttribute("rx", currentBorderRadius);
          rectElement.setAttribute("ry", currentBorderRadius);
        }
        styleCache.borderRadius = borderRadiusStr;
      }
    };

    animationIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [anchorEl, pathConfig, isPlaying, dimensions]);

  if (!anchorEl) return null;

  const { width, height } = dimensions;
  const betspotBorderRadius = 6.75; // Same as betspot border radius (spark-spin uses this)
  const minDimension = Math.min(width, height);
  const initialBorderRadius = minDimension / 2; // Start as perfect circle

  // Use only betspot element dimensions (not including any glow extension)
  const svgWidth = width;
  const svgHeight = height;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: `${svgWidth}px`,
        height: `${svgHeight}px`,
        marginTop: `-${svgHeight / 2}px`,
        marginLeft: `-${svgWidth / 2}px`,
        pointerEvents: "none",
        overflow: "hidden",
        borderRadius: `${initialBorderRadius}px`, // Initial circular shape
        zIndex: 2, // Above factorial-noise (zIndex: 1)
      }}
    >
      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${svgWidth}px`,
          height: `${svgHeight}px`,
          pointerEvents: "none",
          willChange: "transform, opacity",
          opacity: 0,
          visibility: "hidden",
          transform: "scale(0) translateZ(0)",
          transformOrigin: "center center",
        }}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient
            id={`blackHoleGradient_${blackHoleGradientId}`}
            cx="50%"
            cy="50%"
            r="50%"
            gradientUnits="objectBoundingBox"
          >
            <stop offset="0%" stopColor="black" stopOpacity="0.5" />
            <stop offset="100%" stopColor="black" stopOpacity="0.5" />
          </radialGradient>
        </defs>
        <rect
          x="0"
          y="0"
          width={svgWidth}
          height={svgHeight}
          rx={initialBorderRadius}
          ry={initialBorderRadius}
          fill={`url(#blackHoleGradient_${blackHoleGradientId})`}
        />
      </svg>
    </div>
  );
}
