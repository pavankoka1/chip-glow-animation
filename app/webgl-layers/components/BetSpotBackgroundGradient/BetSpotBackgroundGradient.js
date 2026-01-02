"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function BetSpotBackgroundGradient({
  anchorEl,
  pathConfig,
  isPlaying = false,
  globalConfig = {},
}) {
  const svgRef = useRef(null);
  const animationIdRef = useRef(null);
  const startTimeRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  const gradientId = useId();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const svgMaxScaleReachedRef = useRef(false);
  const svgPreviousScaleRef = useRef(1.0);

  // Find SVG animation config to sync timing
  const svgPathConfig = globalConfig.paths?.find(
    (p) => p.type === "svg" && p.enabled !== false
  );

  // Update refs when props change
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      startTimeRef.current = performance.now();
      // Reset max scale tracking when animation starts
      svgMaxScaleReachedRef.current = false;
      svgPreviousScaleRef.current = 1.0;
    } else {
      startTimeRef.current = null;
      // Reset SVG when stopped
      if (svgRef.current) {
        svgRef.current.style.opacity = "0";
        svgRef.current.style.visibility = "hidden";
      }
      // Reset max scale tracking
      svgMaxScaleReachedRef.current = false;
      svgPreviousScaleRef.current = 1.0;
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
    if (!svgRef.current || !anchorEl) return;

    const svgElement = svgRef.current;
    const svgDelay = svgPathConfig?.delay || 540;
    const svgDuration = svgPathConfig?.animationTimeMs || 1000;
    const svgMaxScale = svgPathConfig?.maxScale || 1.1;
    const svgGlowSpread = svgPathConfig?.glowSpread || 0.12;

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      if (!isPlayingRef.current || !startTimeRef.current) {
        return;
      }

      const now = performance.now();
      const elapsed = (now - startTimeRef.current) / 1000;

      // SVG timing
      const svgDelaySec = svgDelay / 1000;
      const svgDurationSec = svgDuration / 1000;
      const svgElapsed = Math.max(0, elapsed - svgDelaySec);
      const svgFadeOutStart = svgDurationSec / 2;
      const svgFadeOutEnd = svgDurationSec;

      // Check if we're in delay period
      const isInDelayPeriod = elapsed < svgDelaySec;
      if (isInDelayPeriod) {
        svgElement.style.visibility = "hidden";
        svgElement.style.opacity = "0";
        return;
      }

      // Calculate glow scale (same logic as SvgAnimationWebGL)
      let glowScale = 1.0;
      if (svgElapsed >= 0 && svgElapsed < svgDurationSec) {
        const progress = svgElapsed / svgDurationSec;
        if (progress < 0.5) {
          // First half: scale up from 1.0 to maxScale
          const firstHalfProgress = progress * 2;
          glowScale = 1.0 + (svgMaxScale - 1.0) * firstHalfProgress;
        } else {
          // Second half: scale down from maxScale to 1.0
          const secondHalfProgress = (progress - 0.5) * 2;
          glowScale = svgMaxScale - (svgMaxScale - 1.0) * secondHalfProgress;
        }
      } else if (svgElapsed >= svgDurationSec) {
        glowScale = 1.0;
      }

      // Track max scale reached (same logic as SvgAnimationWebGL)
      const threshold = 1.09;
      const previousScale = svgPreviousScaleRef.current;
      const wasMaxReached = svgMaxScaleReachedRef.current;

      if (glowScale >= threshold) {
        svgMaxScaleReachedRef.current = true;
      }

      if (!wasMaxReached && previousScale > 1.05 && glowScale < previousScale) {
        svgMaxScaleReachedRef.current = true;
      }

      svgPreviousScaleRef.current = glowScale;

      // Calculate base opacity based on glow scale (same logic as SvgAnimationWebGL)
      const isMaxReached = svgMaxScaleReachedRef.current;
      let baseOpacity = 0;

      if (isMaxReached) {
        baseOpacity = 1;
      } else if (glowScale === 1.0) {
        baseOpacity = 0;
      } else {
        baseOpacity = Math.min(1, Math.max(0, (glowScale - 1) / svgGlowSpread));
      }

      // Apply gradual fade to background in second half (same logic as SvgAnimationWebGL)
      let backgroundOpacity = 0;
      if (svgElapsed >= svgDurationSec) {
        backgroundOpacity = 0;
      } else if (svgElapsed > svgFadeOutStart) {
        // In second half: gradually fade from baseOpacity to 0
        const progressInSecondHalf = (svgElapsed - svgFadeOutStart) / (svgFadeOutEnd - svgFadeOutStart);
        backgroundOpacity = baseOpacity * (1 - progressInSecondHalf);
      } else {
        // In first half: use base opacity
        backgroundOpacity = baseOpacity;
      }

      // Show/hide SVG based on opacity
      if (backgroundOpacity > 0) {
        svgElement.style.visibility = "visible";
        svgElement.style.opacity = backgroundOpacity.toString();
      } else {
        svgElement.style.visibility = "hidden";
        svgElement.style.opacity = "0";
      }
    };

    animationIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [anchorEl, pathConfig, isPlaying, dimensions, svgPathConfig]);

  if (!anchorEl) return null;

  const { width, height } = dimensions;
  const borderRadius = 6.75;

  if (width === 0 || height === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: "none",
        overflow: "hidden",
        borderRadius: `${borderRadius}px`,
        zIndex: 0, // Below factorial-noise (zIndex: 1)
      }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${width}px`,
          height: `${height}px`,
          pointerEvents: "none",
          willChange: "opacity",
          opacity: 0,
          visibility: "hidden",
        }}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient
            id={`betspotBgGradient_${gradientId}`}
            cx="0.5"
            cy="0.5"
            r="0.5"
            gradientUnits="objectBoundingBox"
          >
            <stop offset="0%" stopColor="#834F03" />
            <stop offset="40.8232%" stopColor="#9C6004" />
            <stop offset="100%" stopColor="#CE9404" />
          </radialGradient>
        </defs>
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          rx={borderRadius}
          ry={borderRadius}
          fill={`url(#betspotBgGradient_${gradientId})`}
        />
      </svg>
    </div>
  );
}

