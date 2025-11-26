"use client";

import { useEffect, useRef } from "react";
import useFps from "../../hooks/useFps";
import * as circleAnimation from "../canvas2d/animations/circle";
import * as lineAnimation from "../canvas2d/animations/line";
import * as sparkAnimation from "../canvas2d/animations/spark";
import { DEFAULT_CONFIG, EPSILON, MAX_DT_SEC } from "../canvas2d/constants";
import { CPUMonitor, drawCPUUsage } from "../canvas2d/cpuMonitor";
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
}) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const animationIdRef = useRef(null);
  const lastTsRef = useRef(null);
  const accumulatedSecRef = useRef(0);
  const cpuMonitorRef = useRef(new CPUMonitor(60));
  const fps = useFps({ sampleSize: 60, continuous: false });
  const fpsRef = useRef(fps);
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

  useEffect(() => {
    fpsRef.current = fps;
  }, [fps]);

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
      const program = createProgram(gl, vertexShader, fragmentShader);
      programRef.current = program;

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

        if (anchorEl?.getBoundingClientRect) {
          anchorRectRef.current = anchorEl.getBoundingClientRect();
          anchorCenterRef.current = [
            anchorRectRef.current.left + anchorRectRef.current.width / 2,
            anchorRectRef.current.top + anchorRectRef.current.height / 2,
          ];
        }
      };

      resizeCanvas();
      window.addEventListener("resize", () => {
        resizeCanvas();
        const overlayCanvas = document.getElementById("webgl-overlay");
        if (overlayCanvas) {
          overlayCanvas.width = window.innerWidth;
          overlayCanvas.height = window.innerHeight;
        }
      });

      const precalculatePathMetrics = () => {
        const cfg = getSharedConfigCache(config, DEFAULT_CONFIG);
        const activePaths = getSharedActivePaths(cfg);
        const rect = anchorRectRef.current;
        const [centerX, centerY] = anchorCenterRef.current;

        for (const p of activePaths) {
          const isCirclePath =
            p.type === "circle" || p.circleRadius !== undefined;
          const isLinePath = p.type === "line";

          if (isLinePath) {
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
        cpuMonitorRef.current.startFrame();

        if (!isPlaying) {
          animationIdRef.current = null;
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          return;
        }

        if (lastTsRef.current == null) lastTsRef.current = ts;
        const dtSec = Math.min(MAX_DT_SEC, (ts - lastTsRef.current) / 1000);
        lastTsRef.current = ts;
        accumulatedSecRef.current += dtSec;

        const currentFps = fpsRef.current;
        const frameBudget = 1000 / Math.max(currentFps, 1);
        cpuMonitorRef.current.setFrameBudget(frameBudget);

        const currentTimeSec = accumulatedSecRef.current;
        const rect = anchorRectRef.current;

        const cfg = getSharedConfigCache(config, DEFAULT_CONFIG);
        const activePaths = getSharedActivePaths(cfg);

        let allComplete = activePaths.length > 0;
        const animationTimeMsGlobal =
          cfg.animationTimeMs ?? DEFAULT_CONFIG.animationTimeMs;

        const points = [];

        for (const p of activePaths) {
          const isCirclePathP =
            p.type === "circle" || p.circleRadius !== undefined;
          const isLinePathP = p.type === "line";

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
          if (onAnimationComplete) onAnimationComplete();
          return;
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (points.length === 0) {
          animationIdRef.current = requestAnimationFrame(animate);
          return;
        }

        pointCountRef.current = points.length;

        const positions = new Float32Array(points.length * 2);
        const radii = new Float32Array(points.length);
        const sparkColors = new Float32Array(points.length * 3);
        const glowColors = new Float32Array(points.length * 3);
        const alphas = new Float32Array(points.length);
        const glowRadii = new Float32Array(points.length);

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

        const frameTime = cpuMonitorRef.current.endFrame();
        const cpuUsage = cpuMonitorRef.current.getCPUUsage();

        const overlayCanvas = document.getElementById("webgl-overlay");
        if (overlayCanvas) {
          const ctx2d = overlayCanvas.getContext("2d");
          if (ctx2d) {
            ctx2d.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
            drawCPUUsage(
              ctx2d,
              cpuUsage,
              frameTime,
              fpsRef.current,
              overlayCanvas.width,
              0
            );
          }
        }

        animationIdRef.current = requestAnimationFrame(animate);
      };

      if (isPlaying && !animationIdRef.current) {
        lastTsRef.current = null;
        accumulatedSecRef.current = 0;
        animationIdRef.current = requestAnimationFrame(animate);
      } else if (!isPlaying && animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }

      return () => {
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
          animationIdRef.current = null;
        }
        window.removeEventListener("resize", resizeCanvas);
      };
    } catch (error) {
      console.error("WebGL initialization error:", error);
    }
  }, [anchorEl, config, isPlaying, onAnimationComplete]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      />
      <canvas
        id="webgl-overlay"
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 1 }}
        width={typeof window !== "undefined" ? window.innerWidth : 1920}
        height={typeof window !== "undefined" ? window.innerHeight : 1080}
      />
    </>
  );
}
