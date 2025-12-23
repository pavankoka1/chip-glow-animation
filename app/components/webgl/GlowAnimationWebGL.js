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
  getSharedPrecomputedPaths,
} from "./configs/configCache";
import { DEFAULT_CONFIG, MAX_DT_SEC } from "./constants/constants";
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
  scrubTime = null,
}) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const animationIdRef = useRef(null);
  const lastTsRef = useRef(null);
  const accumulatedSecRef = useRef(0);
  const anchorRectRef = useRef(null);
  const anchorCenterRef = useRef([0, 0]);
  const offsetRef = useRef({ x: 0, y: 0 });

  const shadersRef = useRef({ vertex: null, fragment: null });
  const attribsRef = useRef({});
  const uniformsRef = useRef({});
  const buffersRef = useRef({});
  const bufferDataRef = useRef({ maxPoints: 0 });
  const pathMetricsRef = useRef(new Map());
  const precomputedPathsRef = useRef([]);

  const pointsArraysRef = useRef({
    spinPoints: [],
    otherPoints: [],
    combinedPoints: [],
  });

  const prevGlowIntensitiesRef = useRef({
    chipGlowIntensity: 0,
    perimeterGlowIntensity: 0,
    glowScale: 1.0,
  });
  const lastRectCheckRef = useRef(0);

  // Refs for props to avoid re-triggering the loop effect
  const configRef = useRef(config);
  const isPlayingRef = useRef(isPlaying);
  const scrubTimeRef = useRef(scrubTime);
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  const onGlowIntensityChangeRef = useRef(onGlowIntensityChange);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  useEffect(() => {
    configRef.current = config;
    isPlayingRef.current = isPlaying;
    scrubTimeRef.current = scrubTime;
    onAnimationCompleteRef.current = onAnimationComplete;
    onGlowIntensityChangeRef.current = onGlowIntensityChange;
    onTimeUpdateRef.current = onTimeUpdate;

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
  ]);

  // Main WebGL Resource Lifecycle
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
      const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      const program = createProgram(gl, vs, fs);

      shadersRef.current = { vertex: vs, fragment: fs };
      programRef.current = program;

      gl.useProgram(program);

      attribsRef.current = {
        position: gl.getAttribLocation(program, "a_position"),
        radius: gl.getAttribLocation(program, "a_radius"),
        sparkColor: gl.getAttribLocation(program, "a_sparkColor"),
        glowColor: gl.getAttribLocation(program, "a_glowColor"),
        alpha: gl.getAttribLocation(program, "a_alpha"),
        glowRadius: gl.getAttribLocation(program, "a_glowRadius"),
      };

      uniformsRef.current = {
        resolution: gl.getUniformLocation(program, "u_resolution"),
        devicePixelRatio: gl.getUniformLocation(program, "u_devicePixelRatio"),
        whiteCenterRatio: gl.getUniformLocation(program, "u_whiteCenterRatio"),
        glowOpacityStart: gl.getUniformLocation(program, "u_glowOpacityStart"),
        glowSideSuppression: gl.getUniformLocation(
          program,
          "u_glowSideSuppression"
        ),
      };

      buffersRef.current = {
        position: gl.createBuffer(),
        radius: gl.createBuffer(),
        sparkColor: gl.createBuffer(),
        glowColor: gl.createBuffer(),
        alpha: gl.createBuffer(),
        glowRadius: gl.createBuffer(),
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
      };

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      const animate = (ts) => {
        const curIsPlaying = isPlayingRef.current;
        const curScrubTime = scrubTimeRef.current;

        if (!curIsPlaying && curScrubTime === null) {
          animationIdRef.current = requestAnimationFrame(animate);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          accumulatedSecRef.current = 0;
          lastTsRef.current = null;
          return;
        }

        if (lastTsRef.current == null) lastTsRef.current = ts;
        const dtSec = Math.min(MAX_DT_SEC, (ts - lastTsRef.current) / 1000);
        lastTsRef.current = ts;
        if (curIsPlaying) accumulatedSecRef.current += dtSec;

        const currentTimeSec =
          curScrubTime !== null ? curScrubTime : accumulatedSecRef.current;

        // Call time update for multipliers
        if (
          onTimeUpdateRef.current &&
          (curIsPlaying || curScrubTime !== null)
        ) {
          onTimeUpdateRef.current(currentTimeSec);
        }

        // Sync with anchor
        const now = performance.now();
        if (
          anchorEl?.getBoundingClientRect &&
          now - lastRectCheckRef.current > 100
        ) {
          lastRectCheckRef.current = now;
          const rect = anchorEl.getBoundingClientRect();
          if (
            !anchorRectRef.current ||
            Math.abs(anchorRectRef.current.width - rect.width) > 0.1
          ) {
            anchorRectRef.current = { width: rect.width, height: rect.height };
            pathMetricsRef.current.clear();
          }
          anchorCenterRef.current = [
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          ];
          offsetRef.current = {
            x: anchorCenterRef.current[0],
            y: anchorCenterRef.current[1],
          };
        }

        const cfg = getSharedConfigCache(configRef.current, DEFAULT_CONFIG);
        const activePaths = getSharedActivePaths(cfg);
        const precomputedPaths = precomputedPathsRef.current;

        // Values for intensity callback
        let chipGlowIntensity = 0;
        let perimeterGlowIntensity = 0;
        let glowScale = 1.0;
        let svgElapsed = null;
        let svgDurationSec = null;

        const svgPath = findPrecomputedPathByType(precomputedPaths, "svg");
        if (svgPath && svgPath.svgData) {
          svgDurationSec = svgPath.durationSec;
          svgElapsed = Math.max(0, currentTimeSec - svgPath.delaySec);
          if (svgElapsed < svgDurationSec) {
            const t = svgElapsed / svgDurationSec;
            glowScale =
              t <= 0.5
                ? 1.0 + (svgPath.svgData.maxScale - 1.0) * (t / 0.5)
                : svgPath.svgData.maxScale -
                  (svgPath.svgData.maxScale - 1.0) * ((t - 0.5) / 0.5);
          }
        }

        // Fire intensity callback
        const cb = onGlowIntensityChangeRef.current;
        if (cb) {
          const prev = prevGlowIntensitiesRef.current;
          if (
            Math.abs(prev.glowScale - glowScale) > 0.001 ||
            curScrubTime !== null
          ) {
            cb({
              chipGlowIntensity,
              perimeterGlowIntensity,
              glowScale,
              svgElapsed,
              svgDurationSec,
            });
            prevGlowIntensitiesRef.current = {
              chipGlowIntensity,
              perimeterGlowIntensity,
              glowScale,
              svgElapsed,
              svgDurationSec,
            };
          }
        }

        if (activePaths.length === 0) {
          gl.clear(gl.COLOR_BUFFER_BIT);
          animationIdRef.current = requestAnimationFrame(animate);
          return;
        }

        // Generate points
        const pointsArrays = pointsArraysRef.current;
        pointsArrays.spinPoints.length = 0;
        pointsArrays.otherPoints.length = 0;

        for (const p of precomputedPaths) {
          const elapsed = Math.max(0, currentTimeSec - p.delaySec);
          if (
            elapsed <= 0 ||
            (elapsed >= p.durationSec && curScrubTime === null)
          )
            continue;

          let metrics = pathMetricsRef.current.get(p.id);
          if (!metrics && anchorRectRef.current) {
            const baseRect = {
              width: anchorRectRef.current.width,
              height: anchorRectRef.current.height,
              left: -anchorRectRef.current.width / 2,
              top: -anchorRectRef.current.height / 2,
            };
            metrics = p.isSpinPath
              ? spinAnimation.computeSpinMetrics(
                  p.originalPath,
                  cfg,
                  baseRect,
                  0,
                  0
                )
              : p.isLinePath
              ? lineAnimation.computeLineMetrics(
                  p.originalPath,
                  cfg,
                  baseRect,
                  0,
                  0
                )
              : p.isCirclePath
              ? circleAnimation.computeCircleMetrics(
                  p.originalPath,
                  cfg,
                  baseRect,
                  0,
                  0
                )
              : sparkAnimation.computeSparkMetrics(
                  p.originalPath,
                  cfg,
                  baseRect,
                  0,
                  0
                );
            if (metrics) pathMetricsRef.current.set(p.id, metrics);
          }
          if (!metrics) continue;

          const normT = Math.min(1.0, elapsed / p.durationSec);
          const offset = offsetRef.current;
          const scaledMetrics = {
            ...metrics,
            centerX: offset.x,
            centerY: offset.y,
            halfWidth: metrics.halfWidth * glowScale,
            halfHeight: metrics.halfHeight * glowScale,
          };

          if (p.isSpinPath) {
            spinAnimation.renderSpinToPoints(
              pointsArrays.spinPoints,
              p.originalPath,
              cfg,
              scaledMetrics,
              normT,
              1.0,
              p.headRadius,
              p.tailRadius,
              [1, 1, 1],
              p.glowColorRgb,
              p.glowRadius
            );
          } else if (p.isLinePath) {
            lineAnimation.renderLineToPoints(
              pointsArrays.otherPoints,
              p.originalPath,
              cfg,
              metrics,
              applyEasingLine(normT),
              1.0,
              p.headRadius,
              p.tailRadius,
              p.sparkColorRgb,
              p.glowColorRgb,
              p.glowRadius
            );
          } else if (p.isCirclePath) {
            const span =
              1.0 +
              (p.originalPath.length ?? cfg.length ?? 300) /
                (metrics.pathLength || 1) +
              0.08;
            const phase = applyEasingCircle(normT) * span;
            circleAnimation.renderCircleToPoints(
              pointsArrays.otherPoints,
              p.originalPath,
              cfg,
              metrics,
              Math.max(0, phase - span + 1),
              phase,
              span,
              1.0,
              p.headRadius,
              p.tailRadius,
              p.sparkColorRgb,
              p.glowColorRgb,
              p.glowRadius
            );
          } else {
            const span =
              1.0 +
              (p.originalPath.length ?? cfg.length ?? 300) /
                (metrics.pathLength || 1) +
              0.08;
            const phase = applyEasingSpark(normT) * span;
            sparkAnimation.renderSparkToPoints(
              pointsArrays.otherPoints,
              p.originalPath,
              cfg,
              scaledMetrics,
              Math.max(
                0,
                phase -
                  (p.originalPath.length ?? cfg.length ?? 300) /
                    (metrics.pathLength || 1)
              ),
              phase,
              span,
              1.0,
              anchorRectRef.current,
              p.headRadius,
              p.tailRadius,
              p.sparkColorRgb,
              p.glowColorRgb,
              p.glowRadius,
              p.dotCount,
              p.length
            );
          }
        }

        const points = [
          ...pointsArrays.spinPoints,
          ...pointsArrays.otherPoints,
        ];

        gl.clear(gl.COLOR_BUFFER_BIT);
        if (points.length > 0) {
          const count = points.length;
          if (bufferDataRef.current.maxPoints < count) {
            bufferDataRef.current.maxPoints = count * 2;
            bufferDataRef.current.pos = new Float32Array(count * 4);
            bufferDataRef.current.rad = new Float32Array(count * 2);
            bufferDataRef.current.colS = new Float32Array(count * 6);
            bufferDataRef.current.colG = new Float32Array(count * 6);
            bufferDataRef.current.alp = new Float32Array(count * 2);
            bufferDataRef.current.gRad = new Float32Array(count * 2);
          }

          const { pos, rad, colS, colG, alp, gRad } = bufferDataRef.current;
          const offset = offsetRef.current;

          for (let i = 0; i < count; i++) {
            const p = points[i];
            // Use p.x and p.y directly since they are already in screen coordinates
            pos[i * 2] = p.x;
            pos[i * 2 + 1] = p.y;
            rad[i] = p.radius;
            colS[i * 3] = p.sparkColor[0];
            colS[i * 3 + 1] = p.sparkColor[1];
            colS[i * 3 + 2] = p.sparkColor[2];
            colG[i * 3] = p.glowColor[0];
            colG[i * 3 + 1] = p.glowColor[1];
            colG[i * 3 + 2] = p.glowColor[2];
            alp[i] = p.alpha;
            gRad[i] = p.glowRadius;
          }

          gl.useProgram(program);
          gl.uniform2f(
            uniformsRef.current.resolution,
            canvas.width,
            canvas.height
          );
          gl.uniform1f(
            uniformsRef.current.devicePixelRatio,
            getDevicePixelRatio()
          );
          gl.uniform1f(
            uniformsRef.current.whiteCenterRatio,
            cfg.whiteCenterRatio ?? 0.8
          );
          gl.uniform1f(
            uniformsRef.current.glowOpacityStart,
            cfg.glowOpacityStart ?? 1.2
          );
          gl.uniform1f(
            uniformsRef.current.glowSideSuppression,
            cfg.glowSideSuppression ?? 1.5
          );

          const b = buffersRef.current;
          const a = attribsRef.current;
          gl.bindBuffer(gl.ARRAY_BUFFER, b.position);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            pos.subarray(0, count * 2),
            gl.DYNAMIC_DRAW
          );
          gl.enableVertexAttribArray(a.position);
          gl.vertexAttribPointer(a.position, 2, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, b.radius);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            rad.subarray(0, count),
            gl.DYNAMIC_DRAW
          );
          gl.enableVertexAttribArray(a.radius);
          gl.vertexAttribPointer(a.radius, 1, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, b.sparkColor);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            colS.subarray(0, count * 3),
            gl.DYNAMIC_DRAW
          );
          gl.enableVertexAttribArray(a.sparkColor);
          gl.vertexAttribPointer(a.sparkColor, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, b.glowColor);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            colG.subarray(0, count * 3),
            gl.DYNAMIC_DRAW
          );
          gl.enableVertexAttribArray(a.glowColor);
          gl.vertexAttribPointer(a.glowColor, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, b.alpha);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            alp.subarray(0, count),
            gl.DYNAMIC_DRAW
          );
          gl.enableVertexAttribArray(a.alpha);
          gl.vertexAttribPointer(a.alpha, 1, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, b.glowRadius);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            gRad.subarray(0, count),
            gl.DYNAMIC_DRAW
          );
          gl.enableVertexAttribArray(a.glowRadius);
          gl.vertexAttribPointer(a.glowRadius, 1, gl.FLOAT, false, 0, 0);

          gl.drawArrays(gl.POINTS, 0, count);
        }

        animationIdRef.current = requestAnimationFrame(animate);
      };

      animationIdRef.current = requestAnimationFrame(animate);

      return () => {
        window.removeEventListener("resize", resizeCanvas);
        if (animationIdRef.current)
          cancelAnimationFrame(animationIdRef.current);
        const gl = glRef.current;
        if (gl) {
          Object.values(buffersRef.current).forEach((b) => gl.deleteBuffer(b));
          gl.deleteShader(shadersRef.current.vertex);
          gl.deleteShader(shadersRef.current.fragment);
          gl.deleteProgram(programRef.current);
        }
        glRef.current = null;
        programRef.current = null;
        buffersRef.current = {};
      };
    } catch (e) {
      console.error("WebGL error:", e);
    }
  }, [anchorEl]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
