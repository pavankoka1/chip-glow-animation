"use client";

import { createPortal } from "react-dom";
import { createContext, useContext, useEffect, useRef } from "react";
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

// Context for sharing WebGL resources
const SharedWebGLContext = createContext(null);

console.log("[Debug] SharedWebGLContext module loaded");

export function useSharedWebGL() {
  const context = useContext(SharedWebGLContext);
  if (!context) {
    throw new Error("useSharedWebGL must be used within SharedWebGLProvider");
  }
  return context;
}

/**
 * Shared WebGL Context Provider
 * Manages a single WebGL context that all betspot animations share
 */
export function SharedWebGLProvider({ children }) {
  console.log("[Debug Level 2] SharedWebGLProvider component RENDERED");
  
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const animationIdRef = useRef(null);
  const lastTsRef = useRef(null);

  // WebGL resources (shared across all betspots)
  const shadersRef = useRef({ vertex: null, fragment: null });
  const attribsRef = useRef({});
  const uniformsRef = useRef({});
  const buffersRef = useRef({});
  const bufferDataRef = useRef({ maxPoints: 0 });

  // Registry of all active betspot animations
  const betspotRegistryRef = useRef(new Map());

  // Register/unregister betspot animations
  const registerBetspot = useRef((id, data) => {
    betspotRegistryRef.current.set(id, data);
  });

  const unregisterBetspot = useRef((id) => {
    betspotRegistryRef.current.delete(id);
  });

  // Initialize WebGL context
  useEffect(() => {
    console.log("[Debug Level 2] SharedWebGLProvider useEffect RUNNING (WebGL init)");
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn("[Debug Level 2] SharedWebGLProvider: No canvas element found");
      return;
    }

    console.log("[Debug Level 2] SharedWebGLProvider: Canvas found, creating WebGL context");
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    });

    if (!gl) {
      console.error("[Debug Level 2] WebGL not supported");
      return;
    }

    console.log("[Debug Level 2] SharedWebGLProvider: WebGL context created successfully");
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

      // Main animation loop - renders all registered betspots
      const animate = (ts) => {
        // Always log on first frame to verify loop is running
        if (!window._animationLoopStarted) {
          console.log("[Debug] Animation loop STARTED, registry size:", betspotRegistryRef.current.size);
          window._animationLoopStarted = true;
        }
        
        // Log every second to avoid spam
        if (!window._lastLogTime || ts - window._lastLogTime > 1000) {
          console.log("[Debug] Animation loop running, registry size:", betspotRegistryRef.current.size, "timestamp:", ts);
          window._lastLogTime = ts;
        }
        
        if (lastTsRef.current == null) lastTsRef.current = ts;
        const dtSec = Math.min(MAX_DT_SEC, (ts - lastTsRef.current) / 1000);
        lastTsRef.current = ts;

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Collect all points from all registered betspots
        const allPoints = [];
        const registry = betspotRegistryRef.current;

        if (registry.size === 0) {
          // Only log once per second to avoid spam
          if (!window._lastNoBetspotLog || ts - window._lastNoBetspotLog > 1000) {
            console.log("[Debug] No betspots registered");
            window._lastNoBetspotLog = ts;
          }
          animationIdRef.current = requestAnimationFrame(animate);
          return;
        }

        for (const [id, betspotData] of registry) {
          const {
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
            onTimeUpdate,
            onGlowIntensityChange,
            prevGlowIntensitiesRef,
            lastRectCheckRef,
          } = betspotData;

          const config = configRef?.current || {};
          const isPlaying = isPlayingRef?.current || false;
          const scrubTime = scrubTimeRef?.current ?? null;
          const anchorEl = anchorElRef?.current;
          const zoom = zoomRef?.current || 1.0;

          // Skip if not playing and not scrubbing
          if (!isPlaying && scrubTime === null) {
            if (accumulatedSecRef) accumulatedSecRef.current = 0;
            continue;
          }

          // Initialize accumulated time if needed
          if (accumulatedSecRef && accumulatedSecRef.current === undefined) {
            accumulatedSecRef.current = 0;
          }

          // Update time
          if (isPlaying) {
            if (accumulatedSecRef) {
              if (accumulatedSecRef.current === undefined || accumulatedSecRef.current === null) {
                accumulatedSecRef.current = 0;
              }
              accumulatedSecRef.current += dtSec;
            }
          }

          const currentTimeSec =
            scrubTime !== null ? scrubTime : (accumulatedSecRef?.current || 0);

          // Call time update callback
          const timeUpdateCallback = onTimeUpdate?.current || onTimeUpdate;
          if (timeUpdateCallback && (isPlaying || scrubTime !== null)) {
            timeUpdateCallback(currentTimeSec);
          }

          // Sync with anchor position
          if (anchorEl?.getBoundingClientRect) {
            const now = performance.now();
            const lastCheck = lastRectCheckRef?.current || 0;
            if (now - lastCheck > 100) {
              if (lastRectCheckRef) lastRectCheckRef.current = now;
              const rect = anchorEl.getBoundingClientRect();
              const needsRectUpdate = !anchorRectRef?.current ||
                Math.abs(anchorRectRef.current.width - rect.width) > 0.1 ||
                Math.abs(anchorRectRef.current.height - rect.height) > 0.1;
              
              if (needsRectUpdate) {
                if (anchorRectRef) {
                  anchorRectRef.current = {
                    width: rect.width,
                    height: rect.height,
                  };
                }
                // Clear metrics cache when rect size changes
                // For spark/spin, we recompute each frame anyway, but clear for line/circle
                if (pathMetricsRef?.current) {
                  pathMetricsRef.current.clear();
                }
              }
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              if (anchorCenterRef) {
                anchorCenterRef.current = [centerX, centerY];
              }
              if (offsetRef) {
                offsetRef.current = { x: centerX, y: centerY };
              }
            }
          }

          const cfg = getSharedConfigCache(config, DEFAULT_CONFIG);
          const activePaths = getSharedActivePaths(cfg);
          const precomputedPaths = precomputedPathsRef?.current || [];

          // Only log detailed info once per second per betspot
          const logKey = `_lastBetspotLog_${id}`;
          if (!window[logKey] || ts - window[logKey] > 1000) {
            console.log(`[Debug] Betspot ${id}: activePaths=${activePaths.length}, precomputedPaths=${precomputedPaths.length}, isPlaying=${isPlaying}, scrubTime=${scrubTime}, currentTimeSec=${currentTimeSec.toFixed(3)}`);
            window[logKey] = ts;
          }

          if (activePaths.length === 0) {
            continue;
          }

          // Calculate glow scale for SVG paths
          let glowScale = 1.0;
          const svgPath = findPrecomputedPathByType(precomputedPaths, "svg");
          if (svgPath && svgPath.svgData) {
            const svgDurationSec = svgPath.durationSec;
            const svgElapsed = Math.max(0, currentTimeSec - svgPath.delaySec);
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
          const glowIntensityCallback = onGlowIntensityChange?.current || onGlowIntensityChange;
          if (glowIntensityCallback) {
            const prev = prevGlowIntensitiesRef?.current || {
              glowScale: 1.0,
            };
            if (
              Math.abs(prev.glowScale - glowScale) > 0.001 ||
              scrubTime !== null
            ) {
              glowIntensityCallback({
                chipGlowIntensity: 0,
                perimeterGlowIntensity: 0,
                glowScale,
                svgElapsed: svgPath
                  ? Math.max(0, currentTimeSec - svgPath.delaySec)
                  : null,
                svgDurationSec: svgPath ? svgPath.durationSec : null,
              });
              if (prevGlowIntensitiesRef) {
                prevGlowIntensitiesRef.current = {
                  chipGlowIntensity: 0,
                  perimeterGlowIntensity: 0,
                  glowScale,
                };
              }
            }
          }

          // Generate points for this betspot
          const spinPoints = [];
          const otherPoints = [];

          for (const p of precomputedPaths) {
            const elapsed = Math.max(0, currentTimeSec - p.delaySec);
            
            // Check if this is a spark path (used multiple times in the loop)
            const isSparkPath = !p.isSpinPath && !p.isLinePath && !p.isCirclePath && p.type === "spark";
            
            // Only log spark paths to reduce noise
            if (isSparkPath) {
              const pathLogKey = `_lastPathLog_${id}_${p.id}`;
              if (!window[pathLogKey] || ts - window[pathLogKey] > 500) {
                console.log(`[Spark] Path ${p.id}: type=${p.type}, elapsed=${elapsed.toFixed(3)}, duration=${p.durationSec.toFixed(3)}, shouldRender=${elapsed > 0 && (elapsed < p.durationSec || scrubTime !== null)}`);
                window[pathLogKey] = ts;
              }
            }
            
            if (
              elapsed <= 0 ||
              (elapsed >= p.durationSec && scrubTime === null)
            ) {
              continue;
            }

            // For spark and spin, metrics depend on position, so we need to recompute
            // them each frame (or cache them with position key). For now, recompute.
            // For line and circle, metrics are position-independent, so we can cache them.
            const offset = offsetRef?.current || { x: 0, y: 0 };
            let metrics = pathMetricsRef?.current?.get(p.id);
            
            // For spark and spin, we need to recompute metrics with current position
            // because they use centerX/centerY in path calculations
            const needsRecompute = (p.isSpinPath || isSparkPath) && 
                                   anchorRectRef?.current;
            
            if (isSparkPath) {
              const metricsLogKey = `_lastMetricsLog_${id}_${p.id}`;
              if (!window[metricsLogKey] || ts - window[metricsLogKey] > 500) {
                console.log(`[Spark] Path ${p.id}: isSparkPath=${isSparkPath}, needsRecompute=${needsRecompute}, hasMetrics=${!!metrics}, hasAnchorRect=${!!anchorRectRef?.current}, offset=(${offset.x.toFixed(1)}, ${offset.y.toFixed(1)})`);
                window[metricsLogKey] = ts;
              }
            }
            
            if ((!metrics || needsRecompute) && anchorRectRef?.current) {
              // Debug: Log metrics computation for sparks
              if (isSparkPath) {
                console.log(`[Spark Debug] Computing metrics for path ${p.id}, offset=(${offset.x.toFixed(1)}, ${offset.y.toFixed(1)})`);
              }
              const baseRect = {
                width: anchorRectRef.current.width,
                height: anchorRectRef.current.height,
                left: -anchorRectRef.current.width / 2,
                top: -anchorRectRef.current.height / 2,
              };
              
              // For spark and spin, pass actual center coordinates
              // For line and circle, use local coordinates (0,0)
              const centerX = (p.isSpinPath || (!p.isLinePath && !p.isCirclePath)) ? offset.x : 0;
              const centerY = (p.isSpinPath || (!p.isLinePath && !p.isCirclePath)) ? offset.y : 0;
              
              metrics = p.isSpinPath
                ? spinAnimation.computeSpinMetrics(
                    p.originalPath,
                    cfg,
                    anchorRectRef.current,
                    centerX,
                    centerY
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
                    anchorRectRef.current,
                    centerX,
                    centerY
                  );
              
              // Debug: Log metrics result for sparks
              if (isSparkPath) {
                console.log(`[Spark Debug] Metrics computed for path ${p.id}:`, metrics ? `pathLength=${metrics.pathLength?.toFixed(1)}, a=${metrics.a?.toFixed(1)}, b=${metrics.b?.toFixed(1)}` : 'null');
              }
              
              // Only cache metrics for line and circle (position-independent)
              // For spark and spin, we recompute each frame with current position
              if (metrics && pathMetricsRef) {
                if (p.isLinePath || p.isCirclePath) {
                  pathMetricsRef.current.set(p.id, metrics);
                } else {
                  // For spark/spin, don't cache - recompute each frame
                  // But we can still use it for this frame
                }
              }
            }
            if (!metrics) {
              // Debug: Log missing metrics for sparks
              if (isSparkPath) {
                console.warn(`[Spark Debug] No metrics for path ${p.id}, anchorRectRef:`, anchorRectRef?.current);
              }
              continue;
            }

            const normT = Math.min(1.0, elapsed / p.durationSec);
            // offset is already declared above in the for loop scope
            const scaledMetrics = {
              ...metrics,
              centerX: offset.x,
              centerY: offset.y,
              halfWidth: metrics.halfWidth * glowScale,
              halfHeight: metrics.halfHeight * glowScale,
            };

            if (p.isSpinPath) {
              spinAnimation.renderSpinToPoints(
                spinPoints,
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
              // Line paths also need the offset applied
              const lineMetrics = {
                ...metrics,
                centerX: offset.x,
                centerY: offset.y,
              };
              lineAnimation.renderLineToPoints(
                otherPoints,
                p.originalPath,
                cfg,
                lineMetrics,
                applyEasingLine(normT),
                1.0,
                p.headRadius,
                p.tailRadius,
                p.sparkColorRgb,
                p.glowColorRgb,
                p.glowRadius
              );
            } else if (p.isCirclePath) {
              // Circle paths also need the offset applied
              const circleMetrics = {
                ...metrics,
                centerX: offset.x,
                centerY: offset.y,
              };
              const span =
                1.0 +
                (p.originalPath.length ?? cfg.length ?? 300) /
                  (metrics.pathLength || 1) +
                0.08;
              const phase = applyEasingCircle(normT) * span;
              circleAnimation.renderCircleToPoints(
                otherPoints,
                p.originalPath,
                cfg,
                circleMetrics,
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
              // Spark paths (default case)
              const span =
                1.0 +
                (p.originalPath.length ?? cfg.length ?? 300) /
                  (metrics.pathLength || 1) +
                0.08;
              const phase = applyEasingSpark(normT) * span;
              const pointsBefore = otherPoints.length;
              sparkAnimation.renderSparkToPoints(
                otherPoints,
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
                anchorRectRef?.current,
                p.headRadius,
                p.tailRadius,
                p.sparkColorRgb,
                p.glowColorRgb,
                p.glowRadius,
                p.dotCount * zoom,
                p.length * zoom
              );
              const pointsAfter = otherPoints.length;
              // Debug: Log points generated for sparks
              if (isSparkPath) {
                console.log(`[Spark Debug] Path ${p.id} generated ${pointsAfter - pointsBefore} points (total: ${pointsAfter}), phase=${phase.toFixed(3)}, span=${span.toFixed(3)}`);
              }
            }
          }

          // Attach zoom to points for rendering
          for (const point of spinPoints) {
            point.zoom = zoom;
          }
          for (const point of otherPoints) {
            point.zoom = zoom;
          }

          // Add all points from this betspot to the combined array
          allPoints.push(...spinPoints, ...otherPoints);
          
          // Debug: Log total points for this betspot
          if (spinPoints.length > 0 || otherPoints.length > 0) {
            const sparkCount = otherPoints.filter((_, i) => {
              // This is approximate - we can't easily identify which points are sparks
              return true; // Log all for now
            }).length;
            if (spinPoints.length > 0 || otherPoints.length > 0) {
              console.log(`[Debug] Betspot ${id}: spinPoints=${spinPoints.length}, otherPoints=${otherPoints.length}, total=${spinPoints.length + otherPoints.length}`);
            }
          }
        }

        // Render all points in a single draw call
        if (allPoints.length > 0) {
          const count = allPoints.length;
          if (bufferDataRef.current.maxPoints < count) {
            bufferDataRef.current.maxPoints = count * 2;
            bufferDataRef.current.pos = new Float32Array(count * 2);
            bufferDataRef.current.rad = new Float32Array(count);
            bufferDataRef.current.colS = new Float32Array(count * 3);
            bufferDataRef.current.colG = new Float32Array(count * 3);
            bufferDataRef.current.alp = new Float32Array(count);
            bufferDataRef.current.gRad = new Float32Array(count);
          }

          const { pos, rad, colS, colG, alp, gRad } = bufferDataRef.current;
          const dpr = getDevicePixelRatio();

          for (let i = 0; i < count; i++) {
            const p = allPoints[i];
            const pointZoom = p.zoom || 1.0;
            pos[i * 2] = p.x;
            pos[i * 2 + 1] = p.y;
            rad[i] = p.radius * pointZoom;
            colS[i * 3] = p.sparkColor[0];
            colS[i * 3 + 1] = p.sparkColor[1];
            colS[i * 3 + 2] = p.sparkColor[2];
            colG[i * 3] = p.glowColor[0];
            colG[i * 3 + 1] = p.glowColor[1];
            colG[i * 3 + 2] = p.glowColor[2];
            alp[i] = p.alpha;
            gRad[i] = p.glowRadius * pointZoom;
          }

          // Use the first betspot's config for uniforms (they should all be the same)
          const firstBetspot = Array.from(registry.values())[0];
          const firstConfig = firstBetspot?.config?.current || firstBetspot?.config || {};
          const cfg = getSharedConfigCache(firstConfig, DEFAULT_CONFIG);

          gl.useProgram(program);
          gl.uniform2f(
            uniformsRef.current.resolution,
            canvas.width,
            canvas.height
          );
          gl.uniform1f(uniformsRef.current.devicePixelRatio, dpr);
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
        betspotRegistryRef.current.clear();
      };
    } catch (e) {
      console.error("WebGL error:", e);
    }
  }, []);

  const contextValue = {
    registerBetspot: (id, data) => {
      console.log(`[Debug] SharedWebGLContext.registerBetspot called for: ${id}`);
      registerBetspot.current(id, data);
      console.log(`[Debug] Registry size after register: ${betspotRegistryRef.current.size}`);
    },
    unregisterBetspot: (id) => {
      console.log(`[Debug] SharedWebGLContext.unregisterBetspot called for: ${id}`);
      unregisterBetspot.current(id);
      console.log(`[Debug] Registry size after unregister: ${betspotRegistryRef.current.size}`);
    },
  };

  const canvas = (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10000 }}
    />
  );

  return (
    <SharedWebGLContext.Provider value={contextValue}>
      {children}
      {typeof document !== "undefined"
        ? createPortal(canvas, document.body)
        : canvas}
    </SharedWebGLContext.Provider>
  );
}

