"use client";

import { useEffect, useRef } from "react";
import * as circleAnimation from "../canvas2d/animations/circle";
import * as lineAnimation from "../canvas2d/animations/line";
import * as sparkAnimation from "../canvas2d/animations/spark";
import * as spinAnimation from "../canvas2d/animations/spin";
import {
  applyEasingCircle,
  applyEasingLine,
  applyEasingSpark,
} from "../canvas2d/easing";
import {
  getSharedActivePaths,
  getSharedConfigCache,
  getSharedPathConstants,
  getSharedPathMetrics,
  getSharedPrecomputedPaths,
} from "./configs/configCache";
import {
  BORDER_OPACITY_THRESHOLD,
  DEFAULT_CONFIG,
  EPSILON,
  GLOW_INTENSITY_THRESHOLD,
  MAX_DT_SEC,
} from "./constants/constants";
import {
  findPrecomputedPathByType,
  precomputeAllPaths,
} from "./utils/precomputeUtils";
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
  const pathMetricsRef = useRef(new Map());
  const precomputedPathsRef = useRef([]);
  const devicePixelRatioRef = useRef(getDevicePixelRatio());
  const offsetRef = useRef({ x: 0, y: 0 }); // Offset from base center [0, 0] to actual center
  const bufferRefs = useRef({
    positions: null,
    radii: null,
    sparkColors: null,
    glowColors: null,
    alphas: null,
    glowRadii: null,
    maxPoints: 0,
  });
  const pointsArraysRef = useRef({
    spinPoints: [],
    otherPoints: [],
    combinedPoints: [],
  });
  const shadersRef = useRef({ vertex: null, fragment: null });
  const prevGlowIntensitiesRef = useRef({
    chipGlowIntensity: 0,
    perimeterGlowIntensity: 0,
    glowScale: 1.0,
  });
  const prevBorderOpacityRef = useRef(0);
  const prevBackgroundGradientRef = useRef(null);
  const hasAnimationStartedRef = useRef(false);
  const glowUpdateThrottleRef = useRef(false);
  const timeUpdateThrottleRef = useRef(false);
  const lastRectCheckRef = useRef(0);
  const onGlowIntensityChangeRef = useRef(onGlowIntensityChange);
  const configRef = useRef(config);
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  useEffect(() => {
    onGlowIntensityChangeRef.current = onGlowIntensityChange;
    configRef.current = config;
    onAnimationCompleteRef.current = onAnimationComplete;
    onTimeUpdateRef.current = onTimeUpdate;
    const cfg = getSharedConfigCache(config, DEFAULT_CONFIG);
    const activePaths = getSharedActivePaths(cfg);
    precomputedPathsRef.current = getSharedPrecomputedPaths(
      activePaths,
      cfg,
      () => precomputeAllPaths(activePaths, cfg)
    );
  }, [onGlowIntensityChange, config, onAnimationComplete, onTimeUpdate]);

  useEffect(() => {
    if (anchorEl?.getBoundingClientRect) {
      const computedStyle = window.getComputedStyle(anchorEl);
      const baseWidth = parseFloat(computedStyle.width) || anchorEl.offsetWidth;
      const baseHeight =
        parseFloat(computedStyle.height) || anchorEl.offsetHeight;
      const rect = anchorEl.getBoundingClientRect();
      anchorRectRef.current = {
        ...rect,
        width: baseWidth,
        height: baseHeight,
      };
      anchorCenterRef.current = [
        rect.left + baseWidth / 2,
        rect.top + baseHeight / 2,
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
      shadersRef.current.vertex = vertexShader;
      shadersRef.current.fragment = fragmentShader;
      const program = createProgram(gl, vertexShader, fragmentShader);
      programRef.current = program;
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
          const computedStyle = window.getComputedStyle(anchorEl);
          const baseWidth =
            parseFloat(computedStyle.width) || anchorEl.offsetWidth;
          const baseHeight =
            parseFloat(computedStyle.height) || anchorEl.offsetHeight;

          const transformedRect = anchorEl.getBoundingClientRect();

          anchorRectRef.current = {
            ...transformedRect,
            width: baseWidth,
            height: baseHeight,
          };
          anchorCenterRef.current = [
            transformedRect.left + baseWidth / 2,
            transformedRect.top + baseHeight / 2,
          ];
        }
      };

      resizeCanvas();

      const handleResize = () => {
        resizeCanvas();
      };
      window.addEventListener("resize", handleResize);

      const precalculatePathMetrics = () => {
        const cfg = getSharedConfigCache(configRef.current, DEFAULT_CONFIG);
        const activePaths = getSharedActivePaths(cfg);
        const rect = anchorRectRef.current;
        const [centerX, centerY] = anchorCenterRef.current;

        offsetRef.current = { x: centerX, y: centerY };

        const baseRect = rect
          ? {
              width: rect.width,
              height: rect.height,
              left: -rect.width / 2,
              top: -rect.height / 2,
            }
          : null;

        const sharedMetrics = getSharedPathMetrics(
          activePaths,
          cfg,
          baseRect,
          () => {
            const baseMetrics = new Map();
            const baseCenterX = 0;
            const baseCenterY = 0;

            for (const p of activePaths) {
              const isCirclePath =
                p.type === "circle" || p.circleRadius !== undefined;
              const isLinePath = p.type === "line";
              const isSpinPath = p.type === "spin";

              if (isSpinPath) {
                const metrics = spinAnimation.computeSpinMetrics(
                  p,
                  cfg,
                  baseRect,
                  baseCenterX,
                  baseCenterY
                );
                baseMetrics.set(p.id, metrics);
              } else if (isLinePath) {
                const startPoint = p.startPoint ?? 0;
                const direction = p.direction ?? cfg.direction ?? "clockwise";
                const metrics = lineAnimation.computeLineMetrics(
                  p,
                  cfg,
                  baseRect,
                  baseCenterX,
                  baseCenterY
                );
                baseMetrics.set(p.id, {
                  ...metrics,
                  startPoint,
                  direction,
                });
              } else if (isCirclePath) {
                const metrics = circleAnimation.computeCircleMetrics(
                  p,
                  cfg,
                  baseRect,
                  baseCenterX,
                  baseCenterY
                );
                baseMetrics.set(p.id, metrics);
              } else {
                if (!p.startVertex || !p.endVertex) {
                  continue;
                }
                const metrics = sparkAnimation.computeSparkMetrics(
                  p,
                  cfg,
                  baseRect,
                  baseCenterX,
                  baseCenterY
                );
                if (metrics) {
                  baseMetrics.set(p.id, metrics);
                }
              }
            }
            return baseMetrics;
          }
        );

        pathMetricsRef.current = sharedMetrics;
      };
      precalculatePathMetrics();

      const recalculateOnStart = () => {
        if (anchorEl?.getBoundingClientRect) {
          const computedStyle = window.getComputedStyle(anchorEl);
          const baseWidth =
            parseFloat(computedStyle.width) || anchorEl.offsetWidth;
          const baseHeight =
            parseFloat(computedStyle.height) || anchorEl.offsetHeight;

          const transformedRect = anchorEl.getBoundingClientRect();
          const cachedRect = anchorRectRef.current;
          if (
            !cachedRect ||
            Math.abs(cachedRect.width - baseWidth) > 0.1 ||
            Math.abs(cachedRect.height - baseHeight) > 0.1
          ) {
            anchorRectRef.current = {
              ...transformedRect,
              width: baseWidth,
              height: baseHeight,
            };
            anchorCenterRef.current = [
              transformedRect.left + baseWidth / 2,
              transformedRect.top + baseHeight / 2,
            ];
            pathMetricsRef.current.clear();
            precalculatePathMetrics();
          }
        }
      };

      const animate = (ts) => {
        if (!isPlaying) {
          if (animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current);
            animationIdRef.current = null;
          }
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          prevGlowIntensitiesRef.current = {
            chipGlowIntensity: 0,
            perimeterGlowIntensity: 0,
            glowScale: 1.0,
          };

          if (anchorEl && prevBorderOpacityRef.current > 0) {
            prevBorderOpacityRef.current = 0;
            anchorEl.style.border = "none";
          }

          accumulatedSecRef.current = 0;
          lastTsRef.current = null;
          hasAnimationStartedRef.current = false;
          return;
        }

        if (lastTsRef.current == null) lastTsRef.current = ts;
        const dtSec = Math.min(MAX_DT_SEC, (ts - lastTsRef.current) / 1000);
        lastTsRef.current = ts;
        accumulatedSecRef.current += dtSec;

        const currentTimeSec = accumulatedSecRef.current;

        const now = performance.now();
        const shouldCheck =
          !lastRectCheckRef.current || now - lastRectCheckRef.current > 100;

        if (anchorEl?.getBoundingClientRect && shouldCheck) {
          lastRectCheckRef.current = now;

          const computedStyle = window.getComputedStyle(anchorEl);
          const baseWidth =
            parseFloat(computedStyle.width) || anchorEl.offsetWidth;
          const baseHeight =
            parseFloat(computedStyle.height) || anchorEl.offsetHeight;

          const transformedRect = anchorEl.getBoundingClientRect();
          const oldRect = anchorRectRef.current;
          const newCenterX = transformedRect.left + baseWidth / 2;
          const newCenterY = transformedRect.top + baseHeight / 2;
          const oldCenter = anchorCenterRef.current;

          // Check if rect size changed or center position changed significantly
          const rectSizeChanged =
            !oldRect ||
            Math.abs(oldRect.width - baseWidth) > 0.1 ||
            Math.abs(oldRect.height - baseHeight) > 0.1;
          const centerChanged =
            !oldCenter ||
            Math.abs(oldCenter[0] - newCenterX) > 0.1 ||
            Math.abs(oldCenter[1] - newCenterY) > 0.1;

          if (rectSizeChanged || centerChanged) {
            anchorRectRef.current = {
              ...transformedRect,
              width: baseWidth,
              height: baseHeight,
            };
            anchorCenterRef.current = [newCenterX, newCenterY];

            // Update offset
            offsetRef.current = { x: newCenterX, y: newCenterY };

            // Only recalculate metrics if rect size changed (metrics depend on size, not position)
            if (rectSizeChanged) {
              pathMetricsRef.current.clear();
              precalculatePathMetrics();
            }
          }
        }

        const rect = anchorRectRef.current;

        if (onTimeUpdateRef.current && isPlaying) {
          if (!timeUpdateThrottleRef.current) {
            timeUpdateThrottleRef.current = true;
            onTimeUpdateRef.current(currentTimeSec);
            requestAnimationFrame(() => {
              timeUpdateThrottleRef.current = false;
            });
          }
        }
        if (!hasAnimationStartedRef.current && currentTimeSec > 0) {
          hasAnimationStartedRef.current = true;
        }

        const cfg = getSharedConfigCache(configRef.current, DEFAULT_CONFIG);
        const activePaths = getSharedActivePaths(cfg);
        const precomputedPaths = precomputedPathsRef.current;
        if (activePaths.length === 0) {
          animationIdRef.current = requestAnimationFrame(animate);
          return;
        }

        const objectGlowPath = findPrecomputedPathByType(
          precomputedPaths,
          "objectGlow"
        );
        let chipGlowIntensity = 0;
        let perimeterGlowIntensity = 0;
        let glowScale = 1.0;
        const svgPath = findPrecomputedPathByType(precomputedPaths, "svg");
        if (svgPath && svgPath.svgData) {
          const elapsed = Math.max(0, currentTimeSec - svgPath.delaySec);

          if (elapsed >= 0) {
            if (elapsed < svgPath.durationSec) {
              const normalizedTime = Math.min(
                1.0,
                elapsed / svgPath.durationSec
              );
              const { firstHalfDuration, maxScale, scaleRange } =
                svgPath.svgData;

              if (normalizedTime <= firstHalfDuration) {
                const progress = normalizedTime / firstHalfDuration;
                glowScale = 1.0 + scaleRange * progress;
              } else {
                const progress =
                  (normalizedTime - firstHalfDuration) /
                  (1.0 - firstHalfDuration);
                glowScale = maxScale - scaleRange * progress;
              }
            } else {
              glowScale = 1.0;
            }
          }
        } else if (objectGlowPath) {
          const elapsed = Math.max(0, currentTimeSec - objectGlowPath.delaySec);

          if (elapsed > 0 && elapsed < objectGlowPath.durationSec) {
            const normalizedTime = Math.min(
              1.0,
              elapsed / objectGlowPath.durationSec
            );
            const { firstHalfDuration, scaleRange, intensityRange } =
              objectGlowPath.objectGlowData;

            if (normalizedTime <= firstHalfDuration) {
              const progress = normalizedTime / firstHalfDuration;
              chipGlowIntensity = intensityRange * progress;
              perimeterGlowIntensity = intensityRange * progress;
              glowScale = 1.0 + scaleRange * progress;
            } else {
              const progress =
                (normalizedTime - firstHalfDuration) /
                (1.0 - firstHalfDuration);
              chipGlowIntensity = 1.0 - progress;
              perimeterGlowIntensity = 1.0 - progress;
              glowScale = 1.1 - scaleRange * progress;
            }
          }
        }
        const spinPath = findPrecomputedPathByType(precomputedPaths, "spin");
        let borderOpacity = 0;
        if (spinPath && anchorEl && spinPath.spinBorderData) {
          const elapsed = Math.max(0, currentTimeSec - spinPath.delaySec);
          const { fadeInSec, fadeOutSec } = spinPath.spinBorderData;

          if (elapsed > 0 && elapsed < spinPath.durationSec) {
            if (elapsed < fadeInSec) {
              borderOpacity = elapsed / fadeInSec;
            } else if (elapsed < spinPath.durationSec - fadeOutSec) {
              borderOpacity = 1.0;
            } else {
              const timeUntilEnd = spinPath.durationSec - elapsed;
              borderOpacity = timeUntilEnd / fadeOutSec;
            }
          }
          const { backgroundGradient } = spinPath.spinBorderData || {};
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
          prevBorderOpacityRef.current = 0;
          anchorEl.style.border = "none";
        }

        const callback = onGlowIntensityChangeRef.current;
        if (
          callback &&
          isPlaying &&
          animationIdRef.current &&
          hasAnimationStartedRef.current
        ) {
          const prev = prevGlowIntensitiesRef.current;

          // Calculate SVG elapsed time if there's an SVG path
          let svgElapsed = null;
          let svgDurationSec = null;
          if (svgPath && svgPath.svgData) {
            svgElapsed = Math.max(0, currentTimeSec - svgPath.delaySec);
            svgDurationSec = svgPath.durationSec;
          }

          const hasChanged =
            Math.abs(prev.chipGlowIntensity - chipGlowIntensity) >
              GLOW_INTENSITY_THRESHOLD ||
            Math.abs(prev.perimeterGlowIntensity - perimeterGlowIntensity) >
              GLOW_INTENSITY_THRESHOLD ||
            Math.abs((prev.glowScale || 1.0) - glowScale) >
              GLOW_INTENSITY_THRESHOLD ||
            (svgElapsed !== null &&
              Math.abs((prev.svgElapsed || 0) - svgElapsed) > 0.01);

          if (hasChanged) {
            prevGlowIntensitiesRef.current = {
              chipGlowIntensity,
              perimeterGlowIntensity,
              glowScale,
              svgElapsed,
              svgDurationSec,
            };
            if (!glowUpdateThrottleRef.current) {
              glowUpdateThrottleRef.current = true;
              callback({
                chipGlowIntensity,
                perimeterGlowIntensity,
                glowScale,
                svgElapsed,
                svgDurationSec,
              });

              requestAnimationFrame(() => {
                glowUpdateThrottleRef.current = false;
              });
            }
          }
        }

        let allComplete = true; // Start optimistic - assume all complete
        let hasAnyStartedPath = false;
        const pointsArrays = pointsArraysRef.current;
        const spinPoints = pointsArrays.spinPoints;
        const otherPoints = pointsArrays.otherPoints;

        spinPoints.length = 0;
        otherPoints.length = 0;
        for (const precomputedPath of precomputedPaths) {
          if (!precomputedPath.isSpinPath) continue; // Skip non-spin in first pass

          const elapsed = Math.max(
            0,
            currentTimeSec - precomputedPath.delaySec
          );
          const metrics = pathMetricsRef.current.get(precomputedPath.id);

          if (!metrics) {
            allComplete = false;
            continue;
          }
          const maxDurationSec = Math.max(precomputedPath.durationSec, EPSILON);
          const normalizedTime = Math.min(
            1.0,
            Math.max(0.0, elapsed / maxDurationSec)
          );
          if (elapsed <= 0) {
            continue;
          }
          hasAnyStartedPath = true;

          if (normalizedTime <= 0) {
            continue;
          }

          if (normalizedTime >= 1.0) {
            continue;
          }
          allComplete = false;
          const { headRadius, tailRadius, glowColorRgb, glowRadius } =
            precomputedPath;

          const offset = offsetRef.current;
          const scaledMetrics = {
            ...metrics,
            centerX: offset.x,
            centerY: offset.y,
            halfWidth: metrics.halfWidth * glowScale,
            halfHeight: metrics.halfHeight * glowScale,
          };
          spinAnimation.renderSpinToPoints(
            spinPoints,
            precomputedPath.originalPath,
            cfg,
            scaledMetrics,
            normalizedTime,
            1.0,
            headRadius,
            tailRadius,
            [1, 1, 1],
            glowColorRgb,
            glowRadius
          );
        }
        for (const precomputedPath of precomputedPaths) {
          if (
            precomputedPath.isSpinPath ||
            precomputedPath.isObjectGlowPath ||
            precomputedPath.isMultiplierPath ||
            precomputedPath.isSvgPath
          ) {
            if (precomputedPath.isObjectGlowPath) {
              const elapsed = Math.max(
                0,
                currentTimeSec - precomputedPath.delaySec
              );
              if (elapsed > 0) {
                hasAnyStartedPath = true;
                if (elapsed < precomputedPath.durationSec) {
                  allComplete = false;
                }
              }
            }

            if (precomputedPath.isMultiplierPath) {
              const elapsed = Math.max(
                0,
                currentTimeSec - precomputedPath.delaySec
              );
              if (elapsed > 0) {
                hasAnyStartedPath = true;
                if (elapsed < precomputedPath.durationSec) {
                  allComplete = false;
                }
              }
            }

            if (precomputedPath.isSvgPath) {
              const elapsed = Math.max(
                0,
                currentTimeSec - precomputedPath.delaySec
              );
              if (elapsed > 0) {
                hasAnyStartedPath = true;
                if (elapsed < precomputedPath.durationSec) {
                  allComplete = false;
                }
              }
            }
            continue;
          }

          const elapsed = Math.max(
            0,
            currentTimeSec - precomputedPath.delaySec
          );
          const metrics = pathMetricsRef.current.get(precomputedPath.id);
          if (!metrics) {
            allComplete = false;
            continue;
          }

          const pathLength = metrics.pathLength || 1.0;
          const lineLength =
            precomputedPath.originalPath.length ?? cfg.length ?? 300.0;
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
          const maxDurationSec = Math.max(durationSec, EPSILON);
          const normalizedTime = Math.min(
            1.0,
            Math.max(0.0, elapsed / maxDurationSec)
          );
          if (elapsed <= 0) {
            continue;
          }
          hasAnyStartedPath = true;

          if (normalizedTime <= 0) {
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
          if (isPathComplete) {
            continue;
          }
          allComplete = false;
          const {
            headRadius,
            tailRadius,
            sparkColorRgb,
            glowColorRgb,
            glowRadius,
            dotCount,
            length,
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
            const sparkStartIdx = otherPoints.length;
            const offset = offsetRef.current;
            const sparkMetrics = {
              ...metrics,
              centerX: offset.x,
              centerY: offset.y,
            };
            sparkAnimation.renderSparkToPoints(
              otherPoints,
              precomputedPath.originalPath,
              cfg,
              sparkMetrics,
              segTail,
              segHead,
              totalSpan,
              alpha,
              rect,
              headRadius,
              tailRadius,
              sparkColorRgb,
              glowColorRgb,
              glowRadius,
              dotCount,
              length
            );
            for (let i = sparkStartIdx; i < otherPoints.length; i++) {
              otherPoints[i]._skipOffset = true;
            }
          }
        }

        const combinedPoints = pointsArraysRef.current.combinedPoints;
        const totalPoints = spinPoints.length + otherPoints.length;
        combinedPoints.length = totalPoints;

        let idx = 0;
        for (let i = 0; i < spinPoints.length; i++) {
          combinedPoints[idx++] = { ...spinPoints[i], _skipOffset: true };
        }
        for (let i = 0; i < otherPoints.length; i++) {
          combinedPoints[idx++] = otherPoints[i];
        }
        const points = combinedPoints;
        if (allComplete && (hasAnyStartedPath || activePaths.length === 0)) {
          if (animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current);
            animationIdRef.current = null;
          }

          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          accumulatedSecRef.current = 0;
          lastTsRef.current = null;
          hasAnimationStartedRef.current = false;
          prevGlowIntensitiesRef.current = {
            chipGlowIntensity: 0,
            perimeterGlowIntensity: 0,
            glowScale: 1.0,
          };
          if (anchorEl && prevBorderOpacityRef.current > 0) {
            prevBorderOpacityRef.current = 0;
            anchorEl.style.border = "none";
          }
          const glowCallback = onGlowIntensityChangeRef.current;
          if (glowCallback) {
            glowCallback({
              chipGlowIntensity: 0,
              perimeterGlowIntensity: 0,
              glowScale: 1.0,
            });
          }

          const completeCallback = onAnimationCompleteRef.current;
          if (completeCallback) {
            try {
              completeCallback();
            } catch (error) {
              console.error(
                "[GlowAnimationWebGL] ❌ Error in onAnimationComplete callback:",
                error
              );
            }
          }
          return;
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (points.length === 0) {
          animationIdRef.current = requestAnimationFrame(animate);
          return;
        }

        const buffers = bufferRefs.current;
        const requiredSize = points.length;
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
        const pointsLength = points.length;
        const offset = offsetRef.current;
        for (let i = 0; i < pointsLength; i++) {
          const p = points[i];
          const i2 = i * 2;
          const i3 = i * 3;
          const shouldApplyOffset = !p._skipOffset;
          positions[i2] = p.x + (shouldApplyOffset ? offset.x : 0);
          positions[i2 + 1] = p.y + (shouldApplyOffset ? offset.y : 0);
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

        animationIdRef.current = requestAnimationFrame(animate);
      };

      if (isPlaying && !animationIdRef.current) {
        recalculateOnStart();

        lastTsRef.current = null;
        accumulatedSecRef.current = 0;
        hasAnimationStartedRef.current = false; // Reset flag
        prevGlowIntensitiesRef.current = {
          chipGlowIntensity: -1, // Set to -1 to force first update
          perimeterGlowIntensity: -1,
          glowScale: -1,
        };

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

        prevGlowIntensitiesRef.current = {
          chipGlowIntensity: 0,
          perimeterGlowIntensity: 0,
          glowScale: 1.0,
        };

        if (anchorEl && prevBorderOpacityRef.current > 0) {
          prevBorderOpacityRef.current = 0;
          anchorEl.style.border = "none";
          if (prevBackgroundGradientRef.current) {
            anchorEl.style.background = "";
            prevBackgroundGradientRef.current = null;
          }
        }

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
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
          animationIdRef.current = null;
        }
        window.removeEventListener("resize", handleResize);
        const gl = glRef.current;
        if (gl) {
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
          if (vertexShaderForCleanup) {
            gl.deleteShader(vertexShaderForCleanup);
          }
          if (fragmentShaderForCleanup) {
            gl.deleteShader(fragmentShaderForCleanup);
          }
          if (programForCleanup) {
            gl.deleteProgram(programForCleanup);
          }
        }
        if (pathMetricsForCleanup) {
          pathMetricsForCleanup.clear();
        }
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
