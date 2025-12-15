"use client";

import { useEffect, useRef } from "react";

// Animation modules
import * as circleAnimation from "../canvas2d/animations/circle";
import * as lineAnimation from "../canvas2d/animations/line";
import * as sparkAnimation from "../canvas2d/animations/spark";
import * as spinAnimation from "../canvas2d/animations/spin";

// Constants
import {
  BORDER_OPACITY_THRESHOLD,
  DEFAULT_CONFIG,
  EPSILON,
  GLOW_INTENSITY_THRESHOLD,
  MAX_DT_SEC,
} from "./constants/constants";

// Utils - Direct imports for performance (avoid re-export overhead)
import {
  applyEasingCircle,
  applyEasingLine,
  applyEasingSpark,
} from "../canvas2d/easing";
import { calculateAutoA, getDynamicRotAngle } from "../canvas2d/geometry";
import {
  findPrecomputedPathByType,
  precomputeAllPaths,
} from "./utils/precomputeUtils";

// Config
import {
  getSharedActivePaths,
  getSharedConfigCache,
  getSharedPathConstants,
  getSharedPrecomputedPaths,
} from "./configs/configCache";

// WebGL
import { fragmentShaderSource, vertexShaderSource } from "./webgl/shaders";
import {
  createProgram,
  createShader,
  getDevicePixelRatio,
} from "./webgl/webglUtils";

export default function GlowAnimationWebGL({
  anchorEl,
  config = {},
  isPlaying = false,
  onAnimationComplete,
  onGlowIntensityChange,
  onTimeUpdate,
}) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const animationIdRef = useRef(null);
  const lastTsRef = useRef(null);
  const accumulatedSecRef = useRef(0);
  // Removed CPU monitoring and useFps hook to reduce overhead
  // Using constant 60 FPS assumption for frame timing
  const anchorRectRef = useRef(null);
  const anchorCenterRef = useRef([0, 0]);
  const buffersRef = useRef({
    position: null,
    radius: null,
    sparkColor: null,
    glowColor: null,
    alpha: null,
    glowRadius: null,
  });
  const attribsRef = useRef({
    position: null,
    radius: null,
    sparkColor: null,
    glowColor: null,
    alpha: null,
    glowRadius: null,
  });
  const uniformsRef = useRef({
    resolution: null,
    devicePixelRatio: null,
  });
  const pointCountRef = useRef(0);
  // Path metrics are per-instance (depend on anchorEl position)
  const pathMetricsRef = useRef(new Map());
  // Pre-computed path data (static values that don't change during animation)
  const precomputedPathsRef = useRef([]);
  // Cache device pixel ratio to avoid calling it every frame
  const devicePixelRatioRef = useRef(getDevicePixelRatio());
  // Reusable Float32Array buffers to avoid allocations every frame
  const bufferRefs = useRef({
    positions: null,
    radii: null,
    sparkColors: null,
    glowColors: null,
    alphas: null,
    glowRadii: null,
    maxPoints: 0,
  });
  // Reusable arrays for points (reused instead of creating new ones)
  const pointsArraysRef = useRef({
    spinPoints: [],
    otherPoints: [],
    combinedPoints: [],
  });
  // Store shader references for cleanup
  const shadersRef = useRef({ vertex: null, fragment: null });
  // Track previous glow intensities to avoid unnecessary callbacks
  const prevGlowIntensitiesRef = useRef({
    chipGlowIntensity: 0,
    perimeterGlowIntensity: 0,
    glowScale: 1.0,
  });
  // Track previous border opacity for spin animation
  const prevBorderOpacityRef = useRef(0);
  // Track if animation has actually started to avoid calling callback during initialization
  const hasAnimationStartedRef = useRef(false);
  // Throttle glow intensity updates to reduce CPU usage
  const glowUpdateThrottleRef = useRef(false);
  // Throttle time updates to reduce CPU usage
  const timeUpdateThrottleRef = useRef(false);
  // Store callback in ref to avoid adding it to dependency array (prevents animation reset)
  const onGlowIntensityChangeRef = useRef(onGlowIntensityChange);
  // Store config in ref to prevent unnecessary re-runs
  const configRef = useRef(config);
  // Store onAnimationComplete in ref
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  // Store onTimeUpdate in ref
  const onTimeUpdateRef = useRef(onTimeUpdate);

  // Update refs when they change (without triggering useEffect re-run)
  useEffect(() => {
    onGlowIntensityChangeRef.current = onGlowIntensityChange;
    configRef.current = config;
    onAnimationCompleteRef.current = onAnimationComplete;
    onTimeUpdateRef.current = onTimeUpdate;
    // Update precomputed paths when config changes (pre-compute during idle time)
    // Use shared cache for multiple betspots - all use same config
    const cfg = getSharedConfigCache(config, DEFAULT_CONFIG);
    const activePaths = getSharedActivePaths(cfg);
    precomputedPathsRef.current = getSharedPrecomputedPaths(
      activePaths,
      cfg,
      () => precomputeAllPaths(activePaths, cfg)
    );
  }, [onGlowIntensityChange, config, onAnimationComplete, onTimeUpdate]);

  // Removed useEffect for fps - using constant 60 FPS

  useEffect(() => {
    if (anchorEl?.getBoundingClientRect) {
      anchorRectRef.current = anchorEl.getBoundingClientRect();
      anchorCenterRef.current = [
        anchorRectRef.current.left + anchorRectRef.current.width / 2,
        anchorRectRef.current.top + anchorRectRef.current.height / 2,
      ];
    } else {
      anchorRectRef.current = null;
      anchorCenterRef.current = [0, 0];
    }
  }, [anchorEl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    });

    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    glRef.current = gl;

    // Capture refs for cleanup to satisfy linter
    const pathMetricsForCleanup = pathMetricsRef.current;

    try {
      const vertexShader = createShader(
        gl,
        gl.VERTEX_SHADER,
        vertexShaderSource
      );
      const fragmentShader = createShader(
        gl,
        gl.FRAGMENT_SHADER,
        fragmentShaderSource
      );
      // Store shaders for cleanup
      shadersRef.current.vertex = vertexShader;
      shadersRef.current.fragment = fragmentShader;
      const program = createProgram(gl, vertexShader, fragmentShader);
      programRef.current = program;

      // Capture values for cleanup function
      const vertexShaderForCleanup = vertexShader;
      const fragmentShaderForCleanup = fragmentShader;
      const programForCleanup = program;
      const buffersForCleanup = buffersRef.current;

      gl.useProgram(program);

      const positionLocation = gl.getAttribLocation(program, "a_position");
      const radiusLocation = gl.getAttribLocation(program, "a_radius");
      const sparkColorLocation = gl.getAttribLocation(program, "a_sparkColor");
      const glowColorLocation = gl.getAttribLocation(program, "a_glowColor");
      const alphaLocation = gl.getAttribLocation(program, "a_alpha");
      const glowRadiusLocation = gl.getAttribLocation(program, "a_glowRadius");

      const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
      const devicePixelRatioLocation = gl.getUniformLocation(
        program,
        "u_devicePixelRatio"
      );

      attribsRef.current = {
        position: positionLocation,
        radius: radiusLocation,
        sparkColor: sparkColorLocation,
        glowColor: glowColorLocation,
        alpha: alphaLocation,
        glowRadius: glowRadiusLocation,
      };

      uniformsRef.current = {
        resolution: resolutionLocation,
        devicePixelRatio: devicePixelRatioLocation,
      };

      const positionBuffer = gl.createBuffer();
      const radiusBuffer = gl.createBuffer();
      const sparkColorBuffer = gl.createBuffer();
      const glowColorBuffer = gl.createBuffer();
      const alphaBuffer = gl.createBuffer();
      const glowRadiusBuffer = gl.createBuffer();

      buffersRef.current = {
        position: positionBuffer,
        radius: radiusBuffer,
        sparkColor: sparkColorBuffer,
        glowColor: glowColorBuffer,
        alpha: alphaBuffer,
        glowRadius: glowRadiusBuffer,
      };

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      const resizeCanvas = () => {
        const dpr = getDevicePixelRatio();
        devicePixelRatioRef.current = dpr; // Update cached value
        const width = window.innerWidth;
        const height = window.innerHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        gl.viewport(0, 0, canvas.width, canvas.height);

        // Only set uniforms if program is valid
        if (program && programRef.current) {
          gl.useProgram(program);
          if (uniformsRef.current.resolution) {
            gl.uniform2f(
              uniformsRef.current.resolution,
              canvas.width,
              canvas.height
            );
          }
          if (uniformsRef.current.devicePixelRatio) {
            gl.uniform1f(uniformsRef.current.devicePixelRatio, dpr);
          }
        }

        if (anchorEl?.getBoundingClientRect) {
          anchorRectRef.current = anchorEl.getBoundingClientRect();
          anchorCenterRef.current = [
            anchorRectRef.current.left + anchorRectRef.current.width / 2,
            anchorRectRef.current.top + anchorRectRef.current.height / 2,
          ];
        }
      };

      resizeCanvas();
      // Store resize handler to properly remove it later
      const handleResize = () => {
        resizeCanvas();
      };
      window.addEventListener("resize", handleResize);

      const precalculatePathMetrics = () => {
        const cfg = getSharedConfigCache(configRef.current, DEFAULT_CONFIG);
        const activePaths = getSharedActivePaths(cfg);
        const rect = anchorRectRef.current;
        const [centerX, centerY] = anchorCenterRef.current;

        for (const p of activePaths) {
          const isCirclePath =
            p.type === "circle" || p.circleRadius !== undefined;
          const isLinePath = p.type === "line";
          const isSpinPath = p.type === "spin";

          if (isSpinPath) {
            const prev = pathMetricsRef.current.get(p.id);
            if (
              !prev ||
              prev.centerX !== centerX ||
              prev.centerY !== centerY ||
              prev.isSpin !== true ||
              prev.rectWidth !== rect?.width ||
              prev.rectHeight !== rect?.height
            ) {
              const metrics = spinAnimation.computeSpinMetrics(
                p,
                cfg,
                rect,
                centerX,
                centerY
              );
              pathMetricsRef.current.set(p.id, metrics);
            }
          } else if (isLinePath) {
            const startPoint = p.startPoint ?? 0;
            const direction = p.direction ?? cfg.direction ?? "clockwise";

            const prev = pathMetricsRef.current.get(p.id);
            if (
              !prev ||
              prev.centerX !== centerX ||
              prev.centerY !== centerY ||
              prev.startPoint !== startPoint ||
              prev.direction !== direction ||
              prev.isLine !== true ||
              prev.rectWidth !== rect?.width ||
              prev.rectHeight !== rect?.height
            ) {
              const metrics = lineAnimation.computeLineMetrics(
                p,
                cfg,
                rect,
                centerX,
                centerY
              );
              pathMetricsRef.current.set(p.id, {
                ...metrics,
                startPoint,
                direction,
              });
            }
          } else if (isCirclePath) {
            const circleRadius = p.circleRadius ?? 30;
            const autoA = calculateAutoA(rect);
            const bVal = circleRadius;
            const startVertex = p.startVertex || "BR";
            const direction = p.direction ?? cfg.direction ?? "clockwise";

            const prev = pathMetricsRef.current.get(p.id);
            if (
              !prev ||
              prev.centerX !== centerX ||
              prev.centerY !== centerY ||
              prev.a !== autoA ||
              prev.b !== bVal ||
              prev.rotAngle !== getDynamicRotAngle(startVertex) ||
              prev.circleRadius !== circleRadius ||
              prev.startVertex !== startVertex ||
              prev.direction !== direction ||
              prev.isCircle !== true
            ) {
              const metrics = circleAnimation.computeCircleMetrics(
                p,
                cfg,
                rect,
                centerX,
                centerY
              );
              pathMetricsRef.current.set(p.id, metrics);
            }
          } else {
            if (!p.startVertex || !p.endVertex) {
              continue;
            }

            const prev = pathMetricsRef.current.get(p.id);
            const ellipseCfg = p.ellipse || cfg.ellipse;
            let autoA = ellipseCfg?.a;
            let bVal = ellipseCfg?.b ?? 0.0;
            if (rect && autoA === undefined) {
              autoA = calculateAutoA(rect, 10);
            } else if (autoA === undefined) {
              autoA = 150;
            }

            const ellipseTiltDeg = p.ellipseTiltDeg ?? cfg.ellipseTiltDeg ?? 0;
            const ellipseRotationDeg =
              p.ellipseRotationDeg ?? cfg.ellipseRotationDeg ?? 0;

            if (
              !prev ||
              prev.centerX !== centerX ||
              prev.centerY !== centerY ||
              prev.a !== autoA ||
              prev.b !== bVal ||
              prev.ellipseTiltDeg !== ellipseTiltDeg ||
              prev.ellipseRotationDeg !== ellipseRotationDeg ||
              prev.direction !== (p.direction ?? cfg.direction ?? "auto") ||
              prev.isCircle === true ||
              prev.rectWidth !== rect?.width ||
              prev.rectHeight !== rect?.height
            ) {
              const metrics = sparkAnimation.computeSparkMetrics(
                p,
                cfg,
                rect,
                centerX,
                centerY
              );
              if (metrics) {
                pathMetricsRef.current.set(p.id, metrics);
              }
            }
          }
        }
      };

      precalculatePathMetrics();

      // Pre-computed paths are updated in the useEffect above when config changes
      // This ensures they're ready before animation starts

      const animate = (ts) => {
        // Removed CPU monitoring to reduce overhead

        if (!isPlaying) {
          // Stop animation loop if it's still running
          if (animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current);
            animationIdRef.current = null;
          }
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          // Reset glow ref but don't call callback here to avoid re-render loops
          // The callback will be handled in the useEffect cleanup
          prevGlowIntensitiesRef.current = {
            chipGlowIntensity: 0,
            perimeterGlowIntensity: 0,
            glowScale: 1.0,
          };
          // Reset border when animation stops
          if (anchorEl && prevBorderOpacityRef.current > 0) {
            prevBorderOpacityRef.current = 0;
            anchorEl.style.border = "none";
          }
          // Reset accumulated time
          accumulatedSecRef.current = 0;
          lastTsRef.current = null;
          hasAnimationStartedRef.current = false;
          return;
        }

        if (lastTsRef.current == null) lastTsRef.current = ts;
        const dtSec = Math.min(MAX_DT_SEC, (ts - lastTsRef.current) / 1000);
        lastTsRef.current = ts;
        accumulatedSecRef.current += dtSec;

        // Removed CPU monitoring frame budget calculation

        const currentTimeSec = accumulatedSecRef.current;
        const rect = anchorRectRef.current;

        // Notify parent of current time for multiplier animations
        // Throttle to every other frame to reduce CPU usage (30fps updates instead of 60fps)
        if (onTimeUpdateRef.current && isPlaying) {
          if (!timeUpdateThrottleRef.current) {
            timeUpdateThrottleRef.current = true;
            onTimeUpdateRef.current(currentTimeSec);
            requestAnimationFrame(() => {
              timeUpdateThrottleRef.current = false;
            });
          }
        }

        // Mark that animation has started after first frame
        if (!hasAnimationStartedRef.current && currentTimeSec > 0) {
          hasAnimationStartedRef.current = true;
        }

        // Use cached config and paths (shared across all betspot instances)
        // This avoids recalculating the same config for every betspot every frame
        const cfg = getSharedConfigCache(configRef.current, DEFAULT_CONFIG);
        const activePaths = getSharedActivePaths(cfg);
        const precomputedPaths = precomputedPathsRef.current;

        // Early exit if no paths to animate
        if (activePaths.length === 0) {
          animationIdRef.current = requestAnimationFrame(animate);
          return;
        }

        // Calculate glow intensities based on objectGlow path (id 8)
        // Use pre-computed path data
        const objectGlowPath = findPrecomputedPathByType(
          precomputedPaths,
          "objectGlow"
        );
        let chipGlowIntensity = 0;
        let perimeterGlowIntensity = 0;
        let glowScale = 1.0;

        if (objectGlowPath) {
          const elapsed = Math.max(0, currentTimeSec - objectGlowPath.delaySec);

          if (elapsed > 0 && elapsed < objectGlowPath.durationSec) {
            const normalizedTime = Math.min(
              1.0,
              elapsed / objectGlowPath.durationSec
            );
            const { firstHalfDuration, scaleRange, intensityRange } =
              objectGlowPath.objectGlowData;

            if (normalizedTime <= firstHalfDuration) {
              // First 500ms: glow increases 0-100%, scale 1.0-1.1
              const progress = normalizedTime / firstHalfDuration;
              chipGlowIntensity = intensityRange * progress;
              perimeterGlowIntensity = intensityRange * progress;
              glowScale = 1.0 + scaleRange * progress;
            } else {
              // Last 500ms: glow decreases 100%-0%, scale 1.1-1.0
              const progress =
                (normalizedTime - firstHalfDuration) /
                (1.0 - firstHalfDuration);
              chipGlowIntensity = 1.0 - progress;
              perimeterGlowIntensity = 1.0 - progress;
              glowScale = 1.1 - scaleRange * progress;
            }
          }
        }

        // Handle border for spin animation
        const spinPath = findPrecomputedPathByType(precomputedPaths, "spin");
        let borderOpacity = 0;
        if (spinPath && anchorEl && spinPath.spinBorderData) {
          const elapsed = Math.max(0, currentTimeSec - spinPath.delaySec);
          const { fadeInSec, fadeOutSec } = spinPath.spinBorderData;

          if (elapsed > 0 && elapsed < spinPath.durationSec) {
            // Fade in
            if (elapsed < fadeInSec) {
              borderOpacity = elapsed / fadeInSec;
            }
            // Full opacity
            else if (elapsed < spinPath.durationSec - fadeOutSec) {
              borderOpacity = 1.0;
            }
            // Fade out
            else {
              const timeUntilEnd = spinPath.durationSec - elapsed;
              borderOpacity = timeUntilEnd / fadeOutSec;
            }
          }

          // Apply border to element if opacity changed
          if (
            Math.abs(prevBorderOpacityRef.current - borderOpacity) >
            BORDER_OPACITY_THRESHOLD
          ) {
            prevBorderOpacityRef.current = borderOpacity;
            const { borderWidth, borderRadius, borderColorRgb } =
              spinPath.spinBorderData;

            if (borderOpacity > 0 && borderColorRgb) {
              anchorEl.style.border = `${borderWidth}px solid rgba(${borderColorRgb.r}, ${borderColorRgb.g}, ${borderColorRgb.b}, ${borderOpacity})`;
              anchorEl.style.borderRadius = `${borderRadius}px`;
            } else {
              anchorEl.style.border = "none";
            }
          }
        } else if (!spinPath && anchorEl && prevBorderOpacityRef.current > 0) {
          // Remove border when spin animation is not active
          prevBorderOpacityRef.current = 0;
          anchorEl.style.border = "none";
        }

        // Notify parent of glow intensity changes only when values actually change and animation is playing
        // Throttle updates to reduce CPU usage - only update every 2 frames (30fps instead of 60fps)
        const callback = onGlowIntensityChangeRef.current;
        if (
          callback &&
          isPlaying &&
          animationIdRef.current &&
          hasAnimationStartedRef.current
        ) {
          const prev = prevGlowIntensitiesRef.current;
          const hasChanged =
            Math.abs(prev.chipGlowIntensity - chipGlowIntensity) >
              GLOW_INTENSITY_THRESHOLD ||
            Math.abs(prev.perimeterGlowIntensity - perimeterGlowIntensity) >
              GLOW_INTENSITY_THRESHOLD ||
            Math.abs((prev.glowScale || 1.0) - glowScale) >
              GLOW_INTENSITY_THRESHOLD;

          if (hasChanged) {
            prevGlowIntensitiesRef.current = {
              chipGlowIntensity,
              perimeterGlowIntensity,
              glowScale,
            };
            // Throttle callback to every other frame (30fps) for glow updates
            // This reduces CPU usage while still maintaining smooth visual updates
            if (!glowUpdateThrottleRef.current) {
              glowUpdateThrottleRef.current = true;
              callback({
                chipGlowIntensity,
                perimeterGlowIntensity,
                glowScale,
              });
              // Reset throttle flag on next frame
              requestAnimationFrame(() => {
                glowUpdateThrottleRef.current = false;
              });
            }
          }
        }

        // Track completion - we need to check if all paths that have started are complete
        // A path "has started" if its delay has passed
        // Start with true - will be set to false if any active path is still animating
        // If no paths, nothing to complete (already true)
        let allComplete = true; // Start optimistic - assume all complete
        let hasAnyStartedPath = false;

        // Reuse arrays instead of creating new ones every frame
        const pointsArrays = pointsArraysRef.current;
        const spinPoints = pointsArrays.spinPoints;
        const otherPoints = pointsArrays.otherPoints;
        // Clear arrays for reuse (faster than creating new arrays)
        spinPoints.length = 0;
        otherPoints.length = 0;

        // First pass: render spin animations (will appear behind)
        for (const precomputedPath of precomputedPaths) {
          if (!precomputedPath.isSpinPath) continue; // Skip non-spin in first pass

          const elapsed = Math.max(
            0,
            currentTimeSec - precomputedPath.delaySec
          );
          const metrics = pathMetricsRef.current.get(precomputedPath.id);

          if (!metrics) {
            // Metrics not calculated yet - path can't be complete
            allComplete = false;
            continue;
          }

          // Cache durationSec check to avoid repeated Math.max calls
          const maxDurationSec = Math.max(precomputedPath.durationSec, EPSILON);
          const normalizedTime = Math.min(
            1.0,
            Math.max(0.0, elapsed / maxDurationSec)
          );

          // Check if path has started (delay has passed)
          if (elapsed <= 0) {
            // Path hasn't started yet - don't count it as incomplete
            // If delay hasn't passed, this path doesn't affect completion status
            continue;
          }

          // Path has started
          hasAnyStartedPath = true;

          if (normalizedTime <= 0) {
            // Shouldn't happen if elapsed > 0, but handle it
            continue;
          }

          if (normalizedTime >= 1.0) {
            // Animation complete for this path - don't set allComplete to false
            // Continue checking other paths
            continue;
          }

          // Path has started and is still animating (0 < normalizedTime < 1.0)
          allComplete = false;

          // Use pre-computed values
          const { headRadius, tailRadius, glowColorRgb, glowRadius } =
            precomputedPath;

          // Scale metrics by current glowScale to match BetSpot scaling
          // The BetSpot is scaled via CSS transform, so we need to scale the spin path accordingly
          const scaledMetrics = {
            ...metrics,
            halfWidth: metrics.halfWidth * glowScale,
            halfHeight: metrics.halfHeight * glowScale,
          };

          // Render spin animation with linear time (no easing, no fade)
          spinAnimation.renderSpinToPoints(
            spinPoints,
            precomputedPath.originalPath,
            cfg,
            scaledMetrics,
            normalizedTime,
            1.0, // Full alpha for spin
            headRadius,
            tailRadius,
            [1, 1, 1], // Not used
            glowColorRgb,
            glowRadius
          );
        }

        // Second pass: render other animations (spark, line, circle) - will appear on top
        for (const precomputedPath of precomputedPaths) {
          // Skip spin, objectGlow, and multiplier in second pass
          // (spin handled in first pass, objectGlow handled via CSS, multiplier handled in page.js)
          if (
            precomputedPath.isSpinPath ||
            precomputedPath.isObjectGlowPath ||
            precomputedPath.isMultiplierPath
          ) {
            // Handle objectGlow completion check
            if (precomputedPath.isObjectGlowPath) {
              const elapsed = Math.max(
                0,
                currentTimeSec - precomputedPath.delaySec
              );

              // ObjectGlow completion check
              if (elapsed > 0) {
                // Path has started
                hasAnyStartedPath = true;
                if (elapsed < precomputedPath.durationSec) {
                  // ObjectGlow is still animating
                  allComplete = false;
                }
                // If elapsed >= durationSec, objectGlow is complete
              }
              // If elapsed <= 0, path hasn't started yet, doesn't affect completion
            }
            // Handle multiplier completion check (multipliers are handled separately in page.js)
            if (precomputedPath.isMultiplierPath) {
              const elapsed = Math.max(
                0,
                currentTimeSec - precomputedPath.delaySec
              );

              // Multiplier completion check
              if (elapsed > 0) {
                // Path has started
                hasAnyStartedPath = true;
                if (elapsed < precomputedPath.durationSec) {
                  // Multiplier is still animating
                  allComplete = false;
                }
                // If elapsed >= durationSec, multiplier is complete
              }
              // If elapsed <= 0, path hasn't started yet, doesn't affect completion
            }
            continue;
          }

          const elapsed = Math.max(
            0,
            currentTimeSec - precomputedPath.delaySec
          );
          const metrics = pathMetricsRef.current.get(precomputedPath.id);

          // Skip if metrics haven't been calculated yet
          if (!metrics) {
            // Metrics not calculated yet - path can't be complete
            allComplete = false;
            continue;
          }

          const lineLength =
            precomputedPath.originalPath.length ?? cfg.length ?? 300.0;
          const pathLength = metrics.pathLength || 1.0;

          // Cache path constants (shared across instances since config is same)
          const pathConstantsKey = `${
            precomputedPath.id
          }-${lineLength}-${pathLength}-${precomputedPath.animationTimeMs}-${
            precomputedPath.originalPath.overshoot ?? cfg.overshoot ?? 0.08
          }-${
            precomputedPath.originalPath.fadeWindow ?? cfg.fadeWindow ?? 0.08
          }`;
          const pathConstants = getSharedPathConstants(pathConstantsKey, () => {
            const segmentParam = lineLength / Math.max(pathLength, EPSILON);
            const overshoot =
              precomputedPath.originalPath.overshoot ?? cfg.overshoot ?? 0.08;
            const fadeWindow =
              precomputedPath.originalPath.fadeWindow ?? cfg.fadeWindow ?? 0.08;
            const totalSpan = 1.0 + segmentParam + overshoot;
            const durationSec = precomputedPath.durationSec;
            const fadeWindowDuration = (fadeWindow / totalSpan) * durationSec;
            const totalDuration = durationSec + fadeWindowDuration;
            const completeThreshold = totalSpan + fadeWindow;

            return {
              segmentParam,
              overshoot,
              fadeWindow,
              totalSpan,
              durationSec,
              fadeWindowDuration,
              totalDuration,
              completeThreshold,
            };
          });

          const {
            segmentParam,
            totalSpan,
            totalDuration,
            completeThreshold,
            durationSec,
            fadeWindow,
          } = pathConstants;

          // Cache durationSec check to avoid repeated Math.max calls
          const maxDurationSec = Math.max(durationSec, EPSILON);
          const normalizedTime = Math.min(
            1.0,
            Math.max(0.0, elapsed / maxDurationSec)
          );

          // Check if path has started (delay has passed)
          if (elapsed <= 0) {
            // Path hasn't started yet - don't count it as incomplete
            // If delay hasn't passed, this path doesn't affect completion status
            continue;
          }

          // Path has started
          hasAnyStartedPath = true;

          if (normalizedTime <= 0) {
            // Shouldn't happen if elapsed > 0, but handle it
            continue;
          }

          const scaledPhase =
            (precomputedPath.isCirclePath
              ? applyEasingCircle(normalizedTime)
              : precomputedPath.isLinePath
              ? applyEasingLine(normalizedTime)
              : applyEasingSpark(normalizedTime)) * totalSpan;

          const isPathComplete =
            elapsed >= totalDuration ||
            scaledPhase >= completeThreshold - EPSILON;

          // If path is complete, skip to next path (don't set allComplete to false)
          if (isPathComplete) {
            continue;
          }

          // Path is still animating (not complete)
          allComplete = false;

          // Use pre-computed values
          const {
            headRadius,
            tailRadius,
            sparkColorRgb,
            glowColorRgb,
            glowRadius,
            fadeInSec,
            fadeOutSec,
          } = precomputedPath;

          let fadeInAlpha = 1.0;
          if (precomputedPath.fadeIn > 0) {
            fadeInAlpha = Math.min(1.0, Math.max(0.0, elapsed / fadeInSec));
          }

          let fadeOutAlpha = 1.0;
          if (precomputedPath.fadeOut > 0) {
            const timeUntilEnd = durationSec - elapsed;
            fadeOutAlpha = Math.min(
              1.0,
              Math.max(0.0, timeUntilEnd / fadeOutSec)
            );
          }

          let alpha = fadeInAlpha * fadeOutAlpha;

          const phase = scaledPhase;
          const maxPhase = totalSpan;
          const segHead = Math.min(Math.max(phase, 0), totalSpan);
          const segTail = Math.min(
            Math.max(phase - segmentParam, 0),
            totalSpan
          );

          if (precomputedPath.fadeOut <= 0 && !precomputedPath.isLinePath) {
            if (phase > maxPhase) {
              const fadeMul =
                1.0 -
                Math.min(
                  (phase - maxPhase) / Math.max(fadeWindow, EPSILON),
                  1.0
                );
              alpha *= fadeMul;
            } else if (segTail >= 1.0 - EPSILON) {
              const pastEnd = Math.max(0.0, phase - 1.0);
              const fadeOutPhase = Math.min(
                pastEnd / Math.max(fadeWindow, EPSILON),
                1.0
              );
              alpha *= 1.0 - fadeOutPhase;
            }
          }

          if (alpha <= 0) continue;

          // Colors are already pre-computed in precomputedPath
          if (precomputedPath.isLinePath) {
            const easedTime = applyEasingLine(normalizedTime);
            lineAnimation.renderLineToPoints(
              otherPoints,
              precomputedPath.originalPath,
              cfg,
              metrics,
              easedTime,
              alpha,
              headRadius,
              tailRadius,
              sparkColorRgb,
              glowColorRgb,
              glowRadius
            );
          } else if (precomputedPath.isCirclePath) {
            circleAnimation.renderCircleToPoints(
              otherPoints,
              precomputedPath.originalPath,
              cfg,
              metrics,
              segTail,
              segHead,
              totalSpan,
              alpha,
              headRadius,
              tailRadius,
              sparkColorRgb,
              glowColorRgb,
              glowRadius
            );
          } else {
            sparkAnimation.renderSparkToPoints(
              otherPoints,
              precomputedPath.originalPath,
              cfg,
              metrics,
              segTail,
              segHead,
              totalSpan,
              alpha,
              rect,
              headRadius,
              tailRadius,
              sparkColorRgb,
              glowColorRgb,
              glowRadius
            );
          }
        }

        // Combine points: spin first (behind), then others (on top)
        // Reuse combined array and populate it efficiently
        const combinedPoints = pointsArraysRef.current.combinedPoints;
        const totalPoints = spinPoints.length + otherPoints.length;
        combinedPoints.length = totalPoints;
        // Copy arrays directly for better performance
        let idx = 0;
        for (let i = 0; i < spinPoints.length; i++) {
          combinedPoints[idx++] = spinPoints[i];
        }
        for (let i = 0; i < otherPoints.length; i++) {
          combinedPoints[idx++] = otherPoints[i];
        }
        const points = combinedPoints;

        // Check if all animations are complete
        // allComplete will be true only if:
        // 1. There are no paths (nothing to animate), OR
        // 2. At least one path has started AND all started paths have finished animating
        // If no paths have started yet, don't consider it complete
        if (allComplete && (hasAnyStartedPath || activePaths.length === 0)) {
          // Stop animation loop immediately
          if (animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current);
            animationIdRef.current = null;
          }
          // Clear canvas
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);

          // Reset all animation state
          accumulatedSecRef.current = 0;
          lastTsRef.current = null;
          hasAnimationStartedRef.current = false;

          // Reset glow intensities
          prevGlowIntensitiesRef.current = {
            chipGlowIntensity: 0,
            perimeterGlowIntensity: 0,
            glowScale: 1.0,
          };

          // Reset border
          if (anchorEl && prevBorderOpacityRef.current > 0) {
            prevBorderOpacityRef.current = 0;
            anchorEl.style.border = "none";
          }

          // Reset glow intensities via callback to ensure parent state is updated
          const glowCallback = onGlowIntensityChangeRef.current;
          if (glowCallback) {
            glowCallback({
              chipGlowIntensity: 0,
              perimeterGlowIntensity: 0,
              glowScale: 1.0,
            });
          }

          // Call completion callback - this will update parent isPlaying state
          // This must be called to update the play button state
          const completeCallback = onAnimationCompleteRef.current;
          if (completeCallback) {
            try {
              // Call immediately - React will batch the state update
              completeCallback();
            } catch (error) {
              console.error(
                "[GlowAnimationWebGL] ❌ Error in onAnimationComplete callback:",
                error
              );
            }
          }

          // Don't schedule another frame - animation is complete
          return;
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (points.length === 0) {
          animationIdRef.current = requestAnimationFrame(animate);
          return;
        }

        pointCountRef.current = points.length;

        // Reuse buffers to avoid allocations every frame
        const buffers = bufferRefs.current;
        const requiredSize = points.length;

        // Resize buffers only if needed
        if (!buffers.positions || buffers.maxPoints < requiredSize) {
          buffers.maxPoints =
            Math.max(requiredSize, buffers.maxPoints || 0) * 2; // Allocate 2x to reduce reallocations
          buffers.positions = new Float32Array(buffers.maxPoints * 2);
          buffers.radii = new Float32Array(buffers.maxPoints);
          buffers.sparkColors = new Float32Array(buffers.maxPoints * 3);
          buffers.glowColors = new Float32Array(buffers.maxPoints * 3);
          buffers.alphas = new Float32Array(buffers.maxPoints);
          buffers.glowRadii = new Float32Array(buffers.maxPoints);
        }

        const positions = buffers.positions;
        const radii = buffers.radii;
        const sparkColors = buffers.sparkColors;
        const glowColors = buffers.glowColors;
        const alphas = buffers.alphas;
        const glowRadii = buffers.glowRadii;

        // Optimize buffer population - use direct indexing for better performance
        const pointsLength = points.length;
        for (let i = 0; i < pointsLength; i++) {
          const p = points[i];
          const i2 = i * 2;
          const i3 = i * 3;
          positions[i2] = p.x;
          positions[i2 + 1] = p.y;
          radii[i] = p.radius;
          const sc = p.sparkColor;
          sparkColors[i3] = sc[0];
          sparkColors[i3 + 1] = sc[1];
          sparkColors[i3 + 2] = sc[2];
          const gc = p.glowColor;
          glowColors[i3] = gc[0];
          glowColors[i3 + 1] = gc[1];
          glowColors[i3 + 2] = gc[2];
          alphas[i] = p.alpha;
          glowRadii[i] = p.glowRadius;
        }

        // Only set uniforms if program is valid
        if (!programRef.current) {
          animationIdRef.current = requestAnimationFrame(animate);
          return;
        }

        gl.useProgram(programRef.current);

        if (uniformsRef.current.resolution) {
          gl.uniform2f(
            uniformsRef.current.resolution,
            canvas.width,
            canvas.height
          );
        }
        if (uniformsRef.current.devicePixelRatio) {
          // Use cached device pixel ratio (only update on resize)
          gl.uniform1f(
            uniformsRef.current.devicePixelRatio,
            devicePixelRatioRef.current
          );
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.position);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(attribsRef.current.position);
        gl.vertexAttribPointer(
          attribsRef.current.position,
          2,
          gl.FLOAT,
          false,
          0,
          0
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.radius);
        gl.bufferData(gl.ARRAY_BUFFER, radii, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(attribsRef.current.radius);
        gl.vertexAttribPointer(
          attribsRef.current.radius,
          1,
          gl.FLOAT,
          false,
          0,
          0
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.sparkColor);
        gl.bufferData(gl.ARRAY_BUFFER, sparkColors, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(attribsRef.current.sparkColor);
        gl.vertexAttribPointer(
          attribsRef.current.sparkColor,
          3,
          gl.FLOAT,
          false,
          0,
          0
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.glowColor);
        gl.bufferData(gl.ARRAY_BUFFER, glowColors, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(attribsRef.current.glowColor);
        gl.vertexAttribPointer(
          attribsRef.current.glowColor,
          3,
          gl.FLOAT,
          false,
          0,
          0
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.alpha);
        gl.bufferData(gl.ARRAY_BUFFER, alphas, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(attribsRef.current.alpha);
        gl.vertexAttribPointer(
          attribsRef.current.alpha,
          1,
          gl.FLOAT,
          false,
          0,
          0
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.glowRadius);
        gl.bufferData(gl.ARRAY_BUFFER, glowRadii, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(attribsRef.current.glowRadius);
        gl.vertexAttribPointer(
          attribsRef.current.glowRadius,
          1,
          gl.FLOAT,
          false,
          0,
          0
        );

        gl.drawArrays(gl.POINTS, 0, points.length);

        // Removed overlay canvas CPU monitoring to reduce DOM nodes and event listeners
        // const frameTime = cpuMonitorRef.current.endFrame();
        // const cpuUsage = cpuMonitorRef.current.getCPUUsage();

        animationIdRef.current = requestAnimationFrame(animate);
      };

      if (isPlaying && !animationIdRef.current) {
        lastTsRef.current = null;
        accumulatedSecRef.current = 0;
        hasAnimationStartedRef.current = false; // Reset flag
        // Reset glow when animation starts - update ref but don't call callback yet
        // The callback will be called in the first animate frame if values change
        prevGlowIntensitiesRef.current = {
          chipGlowIntensity: -1, // Set to -1 to force first update
          perimeterGlowIntensity: -1,
          glowScale: -1,
        };
        // Reset border opacity
        prevBorderOpacityRef.current = 0;
        if (anchorEl) {
          anchorEl.style.border = "none";
        }
        animationIdRef.current = requestAnimationFrame(animate);
      } else if (!isPlaying && animationIdRef.current) {
        const wasStarted = hasAnimationStartedRef.current;
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
        hasAnimationStartedRef.current = false;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // Reset glow when animation stops - only call callback if animation had started
        prevGlowIntensitiesRef.current = {
          chipGlowIntensity: 0,
          perimeterGlowIntensity: 0,
          glowScale: 1.0,
        };
        // Reset border when animation stops
        if (anchorEl && prevBorderOpacityRef.current > 0) {
          prevBorderOpacityRef.current = 0;
          anchorEl.style.border = "none";
        }
        // Reset accumulated time
        accumulatedSecRef.current = 0;
        lastTsRef.current = null;
        const callback = onGlowIntensityChangeRef.current;
        if (callback && wasStarted) {
          callback({
            chipGlowIntensity: 0,
            perimeterGlowIntensity: 0,
            glowScale: 1.0,
          });
        }
      }

      return () => {
        // Cleanup animation frame
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
          animationIdRef.current = null;
        }

        // Remove resize listener properly
        window.removeEventListener("resize", handleResize);

        // Cleanup WebGL resources
        const gl = glRef.current;
        if (gl) {
          // Delete buffers (using captured values)
          if (buffersForCleanup.position) {
            gl.deleteBuffer(buffersForCleanup.position);
          }
          if (buffersForCleanup.radius) {
            gl.deleteBuffer(buffersForCleanup.radius);
          }
          if (buffersForCleanup.sparkColor) {
            gl.deleteBuffer(buffersForCleanup.sparkColor);
          }
          if (buffersForCleanup.glowColor) {
            gl.deleteBuffer(buffersForCleanup.glowColor);
          }
          if (buffersForCleanup.alpha) {
            gl.deleteBuffer(buffersForCleanup.alpha);
          }
          if (buffersForCleanup.glowRadius) {
            gl.deleteBuffer(buffersForCleanup.glowRadius);
          }

          // Delete shaders (using captured values)
          if (vertexShaderForCleanup) {
            gl.deleteShader(vertexShaderForCleanup);
          }
          if (fragmentShaderForCleanup) {
            gl.deleteShader(fragmentShaderForCleanup);
          }

          // Delete program (using captured value)
          if (programForCleanup) {
            gl.deleteProgram(programForCleanup);
          }
        }

        // Clear path metrics to free memory (using captured ref)
        if (pathMetricsForCleanup) {
          pathMetricsForCleanup.clear();
        }

        // Clear buffer refs
        bufferRefs.current = {
          positions: null,
          radii: null,
          sparkColors: null,
          glowColors: null,
          alphas: null,
          glowRadii: null,
          maxPoints: 0,
        };
      };
    } catch (error) {
      console.error("WebGL initialization error:", error);
    }
  }, [anchorEl, isPlaying, config]); // Re-compute precomputed paths when config changes

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      />
    </>
  );
}
