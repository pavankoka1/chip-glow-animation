"use client";

import { useEffect, useRef } from "react";
import {
  getSharedActivePaths,
  getSharedConfigCache,
  getSharedPrecomputedPaths,
} from "./configs/configCache";
import { DEFAULT_CONFIG } from "./constants/constants";
import { precomputeAllPaths } from "./utils/precomputeUtils";
import { useSharedWebGL } from "./SharedWebGLContext";

/**
 * GlowAnimationWebGL - Registers with shared WebGL context instead of creating its own
 * This allows multiple betspots to share a single WebGL context efficiently
 */
export default function GlowAnimationWebGL({
  id, // Unique identifier for this betspot animation
  anchorEl,
  config = {},
  isPlaying = false,
  onAnimationComplete,
  onGlowIntensityChange,
  onTimeUpdate,
  scrubTime = null,
  zoom = 1.0,
}) {
  console.log(`[Debug Level 3] GlowAnimationWebGL component RENDERED with id: ${id}`, {
    hasAnchorEl: !!anchorEl,
    isPlaying,
    configKeys: Object.keys(config),
  });
  
  const { registerBetspot, unregisterBetspot } = useSharedWebGL();
  console.log(`[Debug Level 3] GlowAnimationWebGL ${id}: Got shared context, has registerBetspot: ${!!registerBetspot}`);

  // Animation state refs (per betspot)
  const accumulatedSecRef = useRef(0);
  const anchorRectRef = useRef(null);
  const anchorCenterRef = useRef([0, 0]);
  const offsetRef = useRef({ x: 0, y: 0 });
  const pathMetricsRef = useRef(new Map());
  const precomputedPathsRef = useRef([]);
  const prevGlowIntensitiesRef = useRef({
    chipGlowIntensity: 0,
    perimeterGlowIntensity: 0,
    glowScale: 1.0,
  });
  const lastRectCheckRef = useRef(0);

  // Refs for props to avoid re-triggering effects
  const configRef = useRef(config);
  const isPlayingRef = useRef(isPlaying);
  const scrubTimeRef = useRef(scrubTime);
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  const onGlowIntensityChangeRef = useRef(onGlowIntensityChange);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const zoomRef = useRef(zoom);
  const anchorElRef = useRef(anchorEl);

  // Update refs when props change
  useEffect(() => {
    configRef.current = config;
    isPlayingRef.current = isPlaying;
    scrubTimeRef.current = scrubTime;
    onAnimationCompleteRef.current = onAnimationComplete;
    onGlowIntensityChangeRef.current = onGlowIntensityChange;
    onTimeUpdateRef.current = onTimeUpdate;
    zoomRef.current = zoom;
    anchorElRef.current = anchorEl;

    const cfg = getSharedConfigCache(config, DEFAULT_CONFIG);
    const activePaths = getSharedActivePaths(cfg);
    precomputedPathsRef.current = getSharedPrecomputedPaths(
      activePaths,
      cfg,
      () => precomputeAllPaths(activePaths, cfg)
    );
  }, [
    config,
    isPlaying,
    scrubTime,
    onAnimationComplete,
    onGlowIntensityChange,
    onTimeUpdate,
    zoom,
    anchorEl,
  ]);

  // Register/unregister with shared WebGL context
  useEffect(() => {
    console.log(`[Debug Level 3] GlowAnimationWebGL ${id}: useEffect RUNNING (registration)`);
    
    if (!id) {
      console.warn(`[Debug Level 3] GlowAnimationWebGL: id prop is required`);
      return;
    }

    console.log(`[Debug Level 3] GlowAnimationWebGL registering betspot: ${id}`, {
      hasAnchorEl: !!anchorElRef.current,
      isPlaying: isPlayingRef.current,
      hasConfig: !!configRef.current,
      configPaths: configRef.current?.paths?.length || 0,
    });

    // Register this betspot with the shared context
    registerBetspot(id, {
      config: configRef,
      isPlaying: isPlayingRef,
      scrubTime: scrubTimeRef,
      anchorEl: anchorElRef,
      accumulatedSecRef,
      pathMetricsRef,
      anchorRectRef,
      anchorCenterRef,
      offsetRef,
      precomputedPathsRef,
      zoom: zoomRef,
      onTimeUpdate: onTimeUpdateRef,
      onGlowIntensityChange: onGlowIntensityChangeRef,
      prevGlowIntensitiesRef,
      lastRectCheckRef,
    });

    console.log(`[Debug] GlowAnimationWebGL registered betspot: ${id}`);

    // Cleanup: unregister when component unmounts
    return () => {
      console.log(`[Debug] GlowAnimationWebGL unregistering betspot: ${id}`);
      unregisterBetspot(id);
    };
  }, [id, registerBetspot, unregisterBetspot]);

  // Handle animation completion
  useEffect(() => {
    if (!onAnimationCompleteRef.current) return;

    // Check if animation should be marked as complete
    // This logic would need to be handled in the shared context
    // For now, we'll rely on the existing completion logic
  }, [onAnimationComplete]);

  // This component doesn't render anything - it just registers with the shared context
  return null;
}
