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
  
  const styleCacheRef = useRef({
    opacity: null,
    borderRadius: null,
    overflow: null,
  });

  const svgPathConfig = globalConfig.paths?.find(
    (p) => p.type === "svg" && p.enabled !== false
  );

  useEffect(() => {
    const element = anchorEl?.current || anchorEl;
    if (!element || typeof element.getBoundingClientRect !== "function") return;

    const updateDimensions = () => {
      try {
        const width = element.offsetWidth || 0;
        const height = element.offsetHeight || 0;

        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      } catch (error) {
        // Silently handle errors
      }
    };

    if (typeof window !== "undefined") {
      requestAnimationFrame(updateDimensions);

      if (typeof ResizeObserver !== "undefined") {
        const resizeObserver = new ResizeObserver(updateDimensions);
        resizeObserver.observe(element);
        return () => resizeObserver.disconnect();
      }
    }
  }, [anchorEl]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      startTimeRef.current = performance.now();
    } else {
      startTimeRef.current = null;
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

    const svgDelay = svgPathConfig?.delay || 540;
    const svgDuration = svgPathConfig?.animationTimeMs || 1000;
    const svgMaxScale = svgPathConfig?.maxScale || 1.1;
    const svgDelaySec = svgDelay / 1000;
    const svgDurationSec = svgDuration / 1000;
    const maxScaleDiff = svgMaxScale - 1.0;

    const delaySec = merged.delay / 1000;
    const visibleDurationSec = merged.animationTimeMs / 1000;
    const fadeInDurationSec = 0.08;
    const fadeOutDurationSec = 0.12;
    const fadeInEndTime = delaySec + fadeInDurationSec;
    const fadeOutStartTime = delaySec + fadeInDurationSec + visibleDurationSec;
    const animationEndTime = delaySec + fadeInDurationSec + visibleDurationSec + fadeOutDurationSec;

    const styleCache = styleCacheRef.current;

      const animate = () => {
      if (!isPlayingRef.current || !startTimeRef.current) {
        animationIdRef.current = null;
        return;
      }

      animationIdRef.current = requestAnimationFrame(animate);

      const now = performance.now();
      const elapsed = (now - startTimeRef.current) / 1000;

      let currentScale = 1.0;
      if (svgPathConfig && element) {
        const svgElapsed = Math.max(0, elapsed - svgDelaySec);
        if (svgElapsed >= 0 && svgElapsed < svgDurationSec) {
          const progress = svgElapsed / svgDurationSec;
          if (progress < 0.5) {
            currentScale = 1.0 + maxScaleDiff * (progress * 2);
          } else {
            currentScale = svgMaxScale - maxScaleDiff * ((progress - 0.5) * 2);
          }
        } else if (svgElapsed >= svgDurationSec) {
          currentScale = 1.0;
        }
      }

      if (elapsed < delaySec) {
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

      let opacity = 0;
      if (elapsed < fadeInEndTime) {
        const fadeInProgress = (elapsed - delaySec) / fadeInDurationSec;
        opacity = Math.max(0, Math.min(1, fadeInProgress));
      } else if (elapsed >= fadeInEndTime && elapsed < fadeOutStartTime) {
        opacity = 1;
      } else if (elapsed >= fadeOutStartTime && elapsed < animationEndTime) {
        const fadeOutProgress = (elapsed - fadeOutStartTime) / fadeOutDurationSec;
        opacity = Math.max(0, 1 - fadeOutProgress);
      }

      const opacityStr = opacity.toString();
      if (styleCache.opacity !== opacityStr) {
        containerElement.style.opacity = opacityStr;
        styleCache.opacity = opacityStr;
      }

      const isAnimationActive = elapsed >= delaySec && elapsed < animationEndTime;
      const borderRadius = isAnimationActive ? "6.75px" : "";
      const overflow = isAnimationActive ? "hidden" : "";
      const transform = `scale(${currentScale}) translateZ(0)`;

      if (containerElement.style.transform !== transform) {
        containerElement.style.transform = transform;
        containerElement.style.transformOrigin = "center center";
      }

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
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: `${width}px`,
        height: `${height}px`,
        marginTop: `-${height / 2}px`,
        marginLeft: `-${width / 2}px`,
        pointerEvents: "none",
        opacity: 0,
        zIndex: 1,
      }}
    >
      <FactorialNoiseCanvas width={width} height={height} />
    </div>
  );
}

