"use client";

import { useEffect, useRef } from "react";
// Removed useFps hook to eliminate extra RAF loops per instance - using constant 60 FPS instead
import * as circleAnimation from "../canvas2d/animations/circle";
import * as lineAnimation from "../canvas2d/animations/line";
import * as sparkAnimation from "../canvas2d/animations/spark";
import * as spinAnimation from "../canvas2d/animations/spin";
import { DEFAULT_CONFIG, EPSILON, MAX_DT_SEC } from "../canvas2d/constants";
// Removed CPU monitoring to reduce overhead
import {
  applyEasingCircle,
  applyEasingLine,
  applyEasingSpark,
} from "../canvas2d/easing";
import { calculateAutoA, getDynamicRotAngle } from "../canvas2d/geometry";
import { delayToSeconds, hexToRgb } from "../canvas2d/utils";
import {
  getSharedActivePaths,
  getSharedColorCache,
  getSharedConfigCache,
  getSharedPathConstants,
} from "./configCache";
import { fragmentShaderSource, vertexShaderSource } from "./shaders";
import { createProgram, createShader, getDevicePixelRatio } from "./webglUtils";

export default function GlowAnimationWebGL({
  anchorEl,
  config = {},
  isPlaying = false,
  onAnimationComplete,
  onGlowIntensityChange,
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
  // Store callback in ref to avoid adding it to dependency array (prevents animation reset)
  const onGlowIntensityChangeRef = useRef(onGlowIntensityChange);
  // Store config in ref to prevent unnecessary re-runs
  const configRef = useRef(config);
  // Store onAnimationComplete in ref
  const onAnimationCompleteRef = useRef(onAnimationComplete);

  // Update refs when they change (without triggering useEffect re-run)
  useEffect(() => {
    onGlowIntensityChangeRef.current = onGlowIntensityChange;
    configRef.current = config;
    onAnimationCompleteRef.current = onAnimationComplete;
  }, [onGlowIntensityChange, config, onAnimationComplete]);

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

      const animate = (ts) => {
        // Removed CPU monitoring to reduce overhead

        if (!isPlaying) {
          animationIdRef.current = null;
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
          return;
        }

        if (lastTsRef.current == null) lastTsRef.current = ts;
        const dtSec = Math.min(MAX_DT_SEC, (ts - lastTsRef.current) / 1000);
        lastTsRef.current = ts;
        accumulatedSecRef.current += dtSec;

        // Removed CPU monitoring frame budget calculation

        const currentTimeSec = accumulatedSecRef.current;
        const rect = anchorRectRef.current;

        // Mark that animation has started after first frame
        if (!hasAnimationStartedRef.current && currentTimeSec > 0) {
          hasAnimationStartedRef.current = true;
        }

        const cfg = getSharedConfigCache(configRef.current, DEFAULT_CONFIG);
        const activePaths = getSharedActivePaths(cfg);

        // Calculate glow intensities based on objectGlow path (id 8)
        // Find the objectGlow path to get its timing
        const objectGlowPath = activePaths.find((p) => p.type === "objectGlow");
        let chipGlowIntensity = 0;
        let perimeterGlowIntensity = 0;
        let glowScale = 1.0;

        if (objectGlowPath) {
          const delayRaw = objectGlowPath.delay || 540; // Default 540ms
          const delaySec = delayToSeconds(delayRaw);
          const elapsed = Math.max(0, currentTimeSec - delaySec);
          const durationSec = (objectGlowPath.animationTimeMs ?? 1000) / 1000.0;

          if (elapsed > 0 && elapsed < durationSec) {
            const firstHalfDuration = 0.5; // 500ms / 1000ms
            const normalizedTime = Math.min(1.0, elapsed / durationSec);

            if (normalizedTime <= firstHalfDuration) {
              // First 500ms: glow increases 0-100%, scale 1.0-1.1
              const progress = normalizedTime / firstHalfDuration;
              chipGlowIntensity = progress; // 0 to 1
              perimeterGlowIntensity = progress; // 0 to 1
              glowScale = 1.0 + 0.1 * progress; // 1.0 to 1.1
            } else {
              // Last 500ms: glow decreases 100%-0%, scale 1.1-1.0
              const progress =
                (normalizedTime - firstHalfDuration) /
                (1.0 - firstHalfDuration);
              chipGlowIntensity = 1.0 - progress; // 1 to 0
              perimeterGlowIntensity = 1.0 - progress; // 1 to 0
              glowScale = 1.1 - 0.1 * progress; // 1.1 to 1.0
            }
          }
        }

        // Handle border for spin animation
        const spinPath = activePaths.find((p) => p.type === "spin");
        let borderOpacity = 0;
        if (spinPath && anchorEl) {
          const delayRaw = spinPath.delay || 380;
          const delaySec = delayToSeconds(delayRaw);
          const elapsed = Math.max(0, currentTimeSec - delaySec);
          const durationSec = (spinPath.animationTimeMs ?? 14500) / 1000.0;
          const fadeInMs = 300;
          const fadeOutMs = 300;
          const fadeInSec = fadeInMs / 1000.0;
          const fadeOutSec = fadeOutMs / 1000.0;

          if (elapsed > 0 && elapsed < durationSec) {
            // Fade in
            if (elapsed < fadeInSec) {
              borderOpacity = elapsed / fadeInSec;
            }
            // Full opacity
            else if (elapsed < durationSec - fadeOutSec) {
              borderOpacity = 1.0;
            }
            // Fade out
            else {
              const timeUntilEnd = durationSec - elapsed;
              borderOpacity = timeUntilEnd / fadeOutSec;
            }
          }

          // Apply border to element if opacity changed
          if (Math.abs(prevBorderOpacityRef.current - borderOpacity) > 0.001) {
            prevBorderOpacityRef.current = borderOpacity;
            const borderColor = spinPath.borderColor ?? "#eaa13b";
            const borderWidth = spinPath.borderWidth ?? 2;
            const borderRadius = spinPath.borderRadius ?? 5;

            if (borderOpacity > 0) {
              const r = Number.parseInt(borderColor.slice(1, 3), 16);
              const g = Number.parseInt(borderColor.slice(3, 5), 16);
              const b = Number.parseInt(borderColor.slice(5, 7), 16);
              anchorEl.style.border = `${borderWidth}px solid rgba(${r}, ${g}, ${b}, ${borderOpacity})`;
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
        // Only update if animation is actively playing and has started to avoid infinite loops
        const callback = onGlowIntensityChangeRef.current;
        if (
          callback &&
          isPlaying &&
          animationIdRef.current &&
          hasAnimationStartedRef.current
        ) {
          const prev = prevGlowIntensitiesRef.current;
          const hasChanged =
            Math.abs(prev.chipGlowIntensity - chipGlowIntensity) > 0.001 ||
            Math.abs(prev.perimeterGlowIntensity - perimeterGlowIntensity) >
              0.001 ||
            Math.abs((prev.glowScale || 1.0) - glowScale) > 0.001;

          if (hasChanged) {
            prevGlowIntensitiesRef.current = {
              chipGlowIntensity,
              perimeterGlowIntensity,
              glowScale,
            };
            callback({
              chipGlowIntensity,
              perimeterGlowIntensity,
              glowScale,
            });
          }
        }

        let allComplete = activePaths.length > 0;
        const animationTimeMsGlobal =
          cfg.animationTimeMs ?? DEFAULT_CONFIG.animationTimeMs;

        const points = [];

        for (const p of activePaths) {
          const isCirclePathP =
            p.type === "circle" || p.circleRadius !== undefined;
          const isLinePathP = p.type === "line";
          const isSpinPathP = p.type === "spin";
          const isObjectGlowP = p.type === "objectGlow";

          // Handle objectGlow separately - no WebGL points, just CSS glow
          if (isObjectGlowP) {
            const delayRaw = p.delay || 0;
            const delaySec = delayToSeconds(delayRaw);
            const elapsed = Math.max(0, currentTimeSec - delaySec);
            const durationSec = (p.animationTimeMs ?? 1000) / 1000.0;

            if (elapsed <= 0) {
              allComplete = false;
              continue;
            }

            if (elapsed >= durationSec) {
              continue; // Animation complete
            }

            allComplete = false;
            // Don't generate WebGL points - glow is handled via CSS in BetSpot
            continue;
          }

          // Handle spin animation separately - uses linear time progression
          if (isSpinPathP) {
            const delayRaw = p.delay || 380;
            const delaySec = delayToSeconds(delayRaw);
            const elapsed = Math.max(0, currentTimeSec - delaySec);
            const durationSec = (p.animationTimeMs ?? 14500) / 1000.0;
            const metrics = pathMetricsRef.current.get(p.id);

            if (!metrics) {
              allComplete = false;
              continue;
            }

            const normalizedTime = Math.min(
              1.0,
              Math.max(0.0, elapsed / Math.max(durationSec, EPSILON))
            );

            if (elapsed <= 0 || normalizedTime <= 0) {
              allComplete = false;
              continue;
            }

            if (normalizedTime >= 1.0) {
              continue; // Animation complete
            }

            allComplete = false;

            const headRadius = p.headRadius ?? cfg.headRadius ?? 10;
            const tailRadius = p.tailRadius ?? cfg.tailRadius ?? 2;
            const glowColor = p.glowColor ?? cfg.glowColor ?? "#fff391";
            const glowRadius = p.glowRadius ?? cfg.glowRadius ?? 30;

            // Cache color conversions (shared across instances)
            const colorKey = `spin-${glowColor}`;
            const { glowColorRgb } = getSharedColorCache(colorKey, () => {
              const glowColorRgbRaw = hexToRgb(glowColor);
              return {
                sparkColorRgb: [1, 1, 1], // Not used for spin
                glowColorRgb: [
                  glowColorRgbRaw[0] / 255,
                  glowColorRgbRaw[1] / 255,
                  glowColorRgbRaw[2] / 255,
                ],
              };
            });

            // Render spin animation with linear time (no easing, no fade)
            spinAnimation.renderSpinToPoints(
              points,
              p,
              cfg,
              metrics,
              normalizedTime,
              1.0, // Full alpha for spin
              headRadius,
              tailRadius,
              [1, 1, 1], // Not used
              glowColorRgb,
              glowRadius
            );

            continue;
          }

          const delayRaw = p.delay || 0;
          const delaySec = delayToSeconds(delayRaw);
          const metrics = pathMetricsRef.current.get(p.id);
          const lineLength = p.length ?? cfg.length ?? 300.0;
          const pathLength = metrics?.pathLength || 1.0;

          // Cache path constants (shared across instances since config is same)
          const pathConstantsKey = `${p.id}-${lineLength}-${pathLength}-${
            p.animationTimeMs ?? animationTimeMsGlobal
          }-${p.overshoot ?? cfg.overshoot ?? 0.08}-${
            p.fadeWindow ?? cfg.fadeWindow ?? 0.08
          }`;
          const pathConstants = getSharedPathConstants(pathConstantsKey, () => {
            const segmentParam = lineLength / Math.max(pathLength, EPSILON);
            const overshoot = p.overshoot ?? cfg.overshoot ?? 0.08;
            const fadeWindow = p.fadeWindow ?? cfg.fadeWindow ?? 0.08;
            const totalSpan = 1.0 + segmentParam + overshoot;
            const durationSec =
              (p.animationTimeMs ?? animationTimeMsGlobal) / 1000.0;
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
          const elapsed = Math.max(0, currentTimeSec - delaySec);

          const normalizedTime = Math.min(
            1.0,
            Math.max(0.0, elapsed / Math.max(durationSec, EPSILON))
          );

          // Skip if animation hasn't started yet
          if (elapsed <= 0 || normalizedTime <= 0) {
            allComplete = false;
            continue;
          }

          const scaledPhase =
            (isCirclePathP
              ? applyEasingCircle(normalizedTime)
              : isLinePathP
              ? applyEasingLine(normalizedTime)
              : applyEasingSpark(normalizedTime)) * totalSpan;

          const isPathComplete =
            elapsed >= totalDuration ||
            scaledPhase >= completeThreshold - EPSILON;

          if (!isPathComplete) {
            allComplete = false;
          }

          if (isPathComplete) continue;

          const headRadius = p.headRadius ?? cfg.headRadius ?? 10;
          const tailRadius = p.tailRadius ?? cfg.tailRadius ?? 2;
          const sparkColor = p.sparkColor ?? cfg.sparkColor ?? "#ffff00";
          const glowColor = p.glowColor ?? cfg.glowColor ?? "#fff391";
          const glowRadius = p.glowRadius ?? cfg.glowRadius ?? 30;

          let fadeInAlpha = 1.0;
          const fadeIn = p.fadeIn ?? cfg.fadeIn ?? 0;
          if (fadeIn > 0) {
            const fadeInSec = fadeIn / 1000.0;
            fadeInAlpha = Math.min(1.0, Math.max(0.0, elapsed / fadeInSec));
          }

          let fadeOutAlpha = 1.0;
          const fadeOut = p.fadeOut ?? cfg.fadeOut ?? 0;
          if (fadeOut > 0) {
            const fadeOutSec = fadeOut / 1000.0;
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

          if (fadeOut <= 0 && !isLinePathP) {
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

          // Cache color conversions (shared across instances)
          const colorKey = `${sparkColor}-${glowColor}`;
          const { sparkColorRgb, glowColorRgb } = getSharedColorCache(
            colorKey,
            () => {
              const sparkColorRgbRaw = hexToRgb(sparkColor);
              const glowColorRgbRaw = hexToRgb(glowColor);
              return {
                sparkColorRgb: [
                  sparkColorRgbRaw[0] / 255,
                  sparkColorRgbRaw[1] / 255,
                  sparkColorRgbRaw[2] / 255,
                ],
                glowColorRgb: [
                  glowColorRgbRaw[0] / 255,
                  glowColorRgbRaw[1] / 255,
                  glowColorRgbRaw[2] / 255,
                ],
              };
            }
          );

          if (isLinePathP) {
            const easedTime = applyEasingLine(normalizedTime);
            lineAnimation.renderLineToPoints(
              points,
              p,
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
          } else if (isCirclePathP) {
            circleAnimation.renderCircleToPoints(
              points,
              p,
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
              points,
              p,
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

        if (allComplete && activePaths.length > 0) {
          animationIdRef.current = null;
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          if (onAnimationCompleteRef.current) onAnimationCompleteRef.current();
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

        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          positions[i * 2] = p.x;
          positions[i * 2 + 1] = p.y;
          radii[i] = p.radius;
          sparkColors[i * 3] = p.sparkColor[0];
          sparkColors[i * 3 + 1] = p.sparkColor[1];
          sparkColors[i * 3 + 2] = p.sparkColor[2];
          glowColors[i * 3] = p.glowColor[0];
          glowColors[i * 3 + 1] = p.glowColor[1];
          glowColors[i * 3 + 2] = p.glowColor[2];
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
          gl.uniform1f(
            uniformsRef.current.devicePixelRatio,
            getDevicePixelRatio()
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
        };
        // Reset border when animation stops
        if (anchorEl && prevBorderOpacityRef.current > 0) {
          prevBorderOpacityRef.current = 0;
          anchorEl.style.border = "none";
        }
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
  }, [anchorEl, isPlaying]); // Only depend on anchorEl and isPlaying to prevent unnecessary resets

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      />
      {/* <canvas
        id="webgl-overlay"
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 1 }}
        width={typeof window !== "undefined" ? window.innerWidth : 1920}
        height={typeof window !== "undefined" ? window.innerHeight : 1080}
      /> */}
    </>
  );
}
