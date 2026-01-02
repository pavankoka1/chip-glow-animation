"use client";

import { useEffect, useRef } from "react";
import * as sparkAnimation from "../canvas2d/animations/spark";
import { applyEasingSpark } from "../canvas2d/easing";
import { getEllipsePosition2D } from "../canvas2d/geometry";
import {
  getSharedActivePaths,
  getSharedConfigCache,
  getSharedPrecomputedPaths,
} from "../webgl/configs/configCache";
import { DEFAULT_CONFIG, MAX_DT_SEC } from "../webgl/constants/constants";
import { precomputeAllPaths } from "../webgl/utils/precomputeUtils";
import {
  createProgram,
  createShader,
  getDevicePixelRatio,
} from "../webgl/webgl/webglUtils";
import { fragmentShaderSource, vertexShaderSource } from "./astroidConeShaders";

export default function AstroidAnimationWebGL({
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

  const buffersRef = useRef({
    position: null,
    coneType: null,
    index: null,
  });

  const pathMetricsRef = useRef(new Map());
  const precomputedPathsRef = useRef([]);
  const astroidInstancesRef = useRef([]);

  const prevGlowIntensitiesRef = useRef({
    chipGlowIntensity: 0,
    perimeterGlowIntensity: 0,
    glowScale: 1.0,
  });
  const lastRectCheckRef = useRef(0);

  const configRef = useRef(config);
  const isPlayingRef = useRef(isPlaying);
  const scrubTimeRef = useRef(scrubTime);
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  const onGlowIntensityChangeRef = useRef(onGlowIntensityChange);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  // Update refs whenever props change (this doesn't recreate WebGL context)
  useEffect(() => {
    const prevIsPlaying = isPlayingRef.current;
    const prevScrubTime = scrubTimeRef.current;

    if (prevIsPlaying !== isPlaying || prevScrubTime !== scrubTime) {
      console.log("[Astroid] Props changed:", {
        isPlaying,
        scrubTime,
        hasAnchor: !!anchorEl,
      });
    }

    // Reset accumulated time when starting to play
    if (isPlaying && !prevIsPlaying && scrubTime === null) {
      accumulatedSecRef.current = 0;
      lastTsRef.current = null;
    }

    configRef.current = config;
    isPlayingRef.current = isPlaying;
    scrubTimeRef.current = scrubTime;
    onAnimationCompleteRef.current = onAnimationComplete;
    onGlowIntensityChangeRef.current = onGlowIntensityChange;
    onTimeUpdateRef.current = onTimeUpdate;
  }, [
    config,
    isPlaying,
    scrubTime,
    onAnimationComplete,
    onGlowIntensityChange,
    onTimeUpdate,
    anchorEl,
  ]);

  // Precompute paths when config changes
  useEffect(() => {
    const cfg = getSharedConfigCache(config, DEFAULT_CONFIG);
    const activePaths = getSharedActivePaths(cfg);
    const astroidPaths = activePaths.filter((p) => p.type === "astroid");
    precomputedPathsRef.current = getSharedPrecomputedPaths(
      astroidPaths,
      cfg,
      () => precomputeAllPaths(astroidPaths, cfg)
    );
  }, [config]);

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
      const coneTypeLocation = gl.getAttribLocation(program, "a_coneType");
      const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
      const devicePixelRatioLocation = gl.getUniformLocation(
        program,
        "u_devicePixelRatio"
      );
      const scaleLocation = gl.getUniformLocation(program, "u_scale");
      const baseRadiusLocation = gl.getUniformLocation(program, "u_baseRadius");
      const heightLocation = gl.getUniformLocation(program, "u_height");
      const whiteRadiusRatioLocation = gl.getUniformLocation(
        program,
        "u_whiteRadiusRatio"
      );
      const yellowRadiusRatioLocation = gl.getUniformLocation(
        program,
        "u_yellowRadiusRatio"
      );
      const rotateXLocation = gl.getUniformLocation(program, "u_rotateX");
      const rotateYLocation = gl.getUniformLocation(program, "u_rotateY");
      const rotateZLocation = gl.getUniformLocation(program, "u_rotateZ");
      const bendAngleLocation = gl.getUniformLocation(program, "u_bendAngle");
      const positionOffsetLocation = gl.getUniformLocation(
        program,
        "u_positionOffset"
      );
      const glowRadiusLocation = gl.getUniformLocation(program, "u_glowRadius");
      const glowSpreadLocation = gl.getUniformLocation(program, "u_glowSpread");
      const glowColorLocation = gl.getUniformLocation(program, "u_glowColor");

      const positionBuffer = gl.createBuffer();
      const coneTypeBuffer = gl.createBuffer();
      const indexBuffer = gl.createBuffer();

      buffersRef.current = {
        position: positionBuffer,
        coneType: coneTypeBuffer,
        index: indexBuffer,
      };

      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE);

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

      // Generate cone geometry once (reused for all instances)
      const generateConeGeometry = (
        baseRadius,
        height,
        whiteRadiusRatio,
        yellowRadiusRatio
      ) => {
        const sectors = 36;
        const stacks = 30;
        const vertices = [];
        const coneTypes = [];
        const indices = [];
        let vertexIndex = 0;

        for (let coneType = 0; coneType < 2; coneType++) {
          const coneStartIndex = vertexIndex;

          for (let i = 0; i <= stacks; i++) {
            const u = i / stacks;
            const currentRadius = baseRadius * (1 - u);

            for (let j = 0; j <= sectors; j++) {
              const theta = (j / sectors) * 2 * Math.PI;
              const x = currentRadius * Math.cos(theta);
              const y = currentRadius * Math.sin(theta);
              const z = height * u;

              vertices.push(x, y, z);
              coneTypes.push(coneType);

              if (i < stacks && j < sectors) {
                const current = coneStartIndex + i * (sectors + 1) + j;
                const next = coneStartIndex + (i + 1) * (sectors + 1) + j;
                const currentNext =
                  coneStartIndex + i * (sectors + 1) + (j + 1);
                const nextNext =
                  coneStartIndex + (i + 1) * (sectors + 1) + (j + 1);

                indices.push(current, next, currentNext);
                indices.push(currentNext, next, nextNext);
              }
            }
          }

          const baseCenterIndex = vertexIndex;
          vertices.push(0, 0, height);
          coneTypes.push(coneType);
          vertexIndex++;

          const baseStartIndex = vertexIndex;
          for (let j = 0; j <= sectors; j++) {
            const theta = (j / sectors) * 2 * Math.PI;
            const x = baseRadius * Math.cos(theta);
            const y = baseRadius * Math.sin(theta);
            const z = height;
            vertices.push(x, y, z);
            coneTypes.push(coneType);
            vertexIndex++;
          }

          for (let j = 0; j < sectors; j++) {
            const v1 = baseStartIndex + j;
            const v2 = baseStartIndex + (j + 1);
            indices.push(baseCenterIndex, v1, v2);
          }

          vertexIndex = vertices.length / 3;
        }

        const hemisphereSectors = 36;
        const hemisphereStacks = 18;
        const whiteHemisphereRadius = baseRadius * whiteRadiusRatio;
        const whiteHemisphereStartIndex = vertexIndex;

        for (let i = 0; i <= hemisphereStacks; i++) {
          const phi = Math.PI / 2 - (i / hemisphereStacks) * (Math.PI / 2);
          const currentRadius = whiteHemisphereRadius * Math.sin(phi);

          for (let j = 0; j <= hemisphereSectors; j++) {
            const theta = (j / hemisphereSectors) * 2 * Math.PI;
            const x = currentRadius * Math.cos(theta);
            const y = currentRadius * Math.sin(theta);
            const z = height - whiteHemisphereRadius * Math.cos(phi);

            vertices.push(x, y, z);
            coneTypes.push(0);

            if (i < hemisphereStacks && j < hemisphereSectors) {
              const current =
                whiteHemisphereStartIndex + i * (hemisphereSectors + 1) + j;
              const next =
                whiteHemisphereStartIndex +
                (i + 1) * (hemisphereSectors + 1) +
                j;
              const currentNext =
                whiteHemisphereStartIndex +
                i * (hemisphereSectors + 1) +
                (j + 1);
              const nextNext =
                whiteHemisphereStartIndex +
                (i + 1) * (hemisphereSectors + 1) +
                (j + 1);

              indices.push(current, currentNext, next);
              indices.push(currentNext, nextNext, next);
            }
          }
        }

        vertexIndex = vertices.length / 3;

        const yellowHemisphereRadius =
          baseRadius * (whiteRadiusRatio + yellowRadiusRatio);
        const yellowHemisphereStartIndex = vertexIndex;

        for (let i = 0; i <= hemisphereStacks; i++) {
          const phi = Math.PI / 2 - (i / hemisphereStacks) * (Math.PI / 2);
          const currentRadius = yellowHemisphereRadius * Math.sin(phi);

          for (let j = 0; j <= hemisphereSectors; j++) {
            const theta = (j / hemisphereSectors) * 2 * Math.PI;
            const x = currentRadius * Math.cos(theta);
            const y = currentRadius * Math.sin(theta);
            const z = height - yellowHemisphereRadius * Math.cos(phi);

            vertices.push(x, y, z);
            coneTypes.push(1);

            if (i < hemisphereStacks && j < hemisphereSectors) {
              const current =
                yellowHemisphereStartIndex + i * (hemisphereSectors + 1) + j;
              const next =
                yellowHemisphereStartIndex +
                (i + 1) * (hemisphereSectors + 1) +
                j;
              const currentNext =
                yellowHemisphereStartIndex +
                i * (hemisphereSectors + 1) +
                (j + 1);
              const nextNext =
                yellowHemisphereStartIndex +
                (i + 1) * (hemisphereSectors + 1) +
                (j + 1);

              indices.push(current, currentNext, next);
              indices.push(currentNext, nextNext, next);
            }
          }
        }

        return {
          vertices,
          coneTypes,
          indices,
        };
      };

      const animate = (ts) => {
        // Always continue the animation loop
        animationIdRef.current = requestAnimationFrame(animate);

        const curIsPlaying = isPlayingRef.current;
        const curScrubTime = scrubTimeRef.current;

        // Debug log only on state changes (reduced logging)
        // Removed per-frame logging to reduce console spam

        if (!curIsPlaying && curScrubTime === null) {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          // Don't reset accumulatedSecRef here - keep it for when play resumes
          if (lastTsRef.current !== null) {
            lastTsRef.current = null;
          }
          return;
        }

        // Reset time when starting to play (if not scrubbing)
        if (lastTsRef.current == null) {
          lastTsRef.current = ts;
          if (curScrubTime === null && curIsPlaying) {
            accumulatedSecRef.current = 0;
          }
        }

        const dtSec = lastTsRef.current
          ? Math.min(MAX_DT_SEC, (ts - lastTsRef.current) / 1000)
          : 0;
        lastTsRef.current = ts;

        if (curIsPlaying && curScrubTime === null) {
          accumulatedSecRef.current += dtSec;
        }

        const currentTimeSec =
          curScrubTime !== null ? curScrubTime : accumulatedSecRef.current;

        if (
          onTimeUpdateRef.current &&
          (curIsPlaying || curScrubTime !== null)
        ) {
          onTimeUpdateRef.current(currentTimeSec);
        }

        // Debug log to verify animation is running
        if (curIsPlaying && Math.random() < 0.01) {
          console.log(
            "[Astroid] Animation running, time:",
            currentTimeSec.toFixed(3),
            "accumulated:",
            accumulatedSecRef.current.toFixed(3)
          );
        }

        // Debug log time updates (reduced logging)
        // Removed per-frame logging to reduce console spam

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
          const dpr = getDevicePixelRatio();
          anchorCenterRef.current = [
            (rect.left + rect.width / 2) * dpr,
            (rect.top + rect.height / 2) * dpr,
          ];
          offsetRef.current = {
            x: anchorCenterRef.current[0],
            y: anchorCenterRef.current[1],
          };
        }

        // Generate astroid instances along ellipse paths
        const astroidInstances = [];
        let allComplete = true;

        // Only generate instances when playing or scrubbing
        if (curIsPlaying || curScrubTime !== null) {
          const cfg = getSharedConfigCache(configRef.current, DEFAULT_CONFIG);
          const activePaths = getSharedActivePaths(cfg);
          const astroidPaths = activePaths.filter((p) => p.type === "astroid");
          const precomputedPaths = precomputedPathsRef.current;

          if (precomputedPaths && precomputedPaths.length > 0) {
            for (const p of precomputedPaths) {
              // Only process astroid paths
              if (p.type !== "astroid") continue;

              const elapsed = Math.max(0, currentTimeSec - p.delaySec);
              // Skip if path hasn't started or has finished (unless scrubbing)
              if (
                elapsed <= 0 ||
                (elapsed >= p.durationSec && curScrubTime === null)
              ) {
                if (elapsed < p.durationSec) allComplete = false;
                continue;
              }

              const durationSec = p.durationSec;
              const normalizedTime = Math.min(1.0, elapsed / durationSec);
              if (normalizedTime < 1.0) allComplete = false;

              let metrics = pathMetricsRef.current.get(p.id);
              if (!metrics) {
                if (!anchorRectRef.current) {
                  continue;
                }
                const baseRect = {
                  width: anchorRectRef.current.width,
                  height: anchorRectRef.current.height,
                  left: -anchorRectRef.current.width / 2,
                  top: -anchorRectRef.current.height / 2,
                };
                metrics = sparkAnimation.computeSparkMetrics(
                  p.originalPath,
                  cfg,
                  baseRect,
                  0,
                  0
                );
                if (metrics) {
                  pathMetricsRef.current.set(p.id, metrics);
                } else {
                  continue;
                }
              }

              const easedT = applyEasingSpark(normalizedTime);
              const offset = offsetRef.current;

              // Calculate position along ellipse path
              const thetaStart = 0.0;
              const thetaEnd = metrics.actualThetaEnd || metrics.thetaEndLocal;
              const theta = thetaStart + (thetaEnd - thetaStart) * easedT;

              const [x, y] = getEllipsePosition2D(
                theta,
                metrics.a,
                metrics.b,
                metrics.rotAngle,
                offset.x,
                offset.y,
                metrics.ellipseTiltDeg,
                metrics.ellipseRotationDeg
              );

              // Calculate direction (tangent) for rotation
              const thetaNext = theta + 0.01;
              const [xNext, yNext] = getEllipsePosition2D(
                thetaNext,
                metrics.a,
                metrics.b,
                metrics.rotAngle,
                offset.x,
                offset.y,
                metrics.ellipseTiltDeg,
                metrics.ellipseRotationDeg
              );
              const dx = xNext - x;
              const dy = yNext - y;
              const angle = Math.atan2(dy, dx);

              // Astroid properties - use exact same dimensions as astroid page
              // astroid page: baseRadius: 7.0, height: 74.0, scale: 20
              // But we need to account for the scale in the shader, so use baseRadius/height directly
              const baseRadius = 7.0;
              const height = 74.0;

              astroidInstances.push({
                x,
                y,
                baseRadius,
                height,
                whiteRadiusRatio: 0.6,
                yellowRadiusRatio: 0.4,
                rotateX: 0,
                rotateY: 0,
                rotateZ: angle + Math.PI / 2,
                bendAngle: 0,
                scale: 1.0, // Scale is applied in shader, so use 1.0 here
              });
            }

            // Call onAnimationComplete when all paths are complete
            if (
              allComplete &&
              astroidPaths.length > 0 &&
              curIsPlaying &&
              onAnimationCompleteRef.current
            ) {
              onAnimationCompleteRef.current();
            }
          }
        }

        astroidInstancesRef.current = astroidInstances;

        // Render all astroid instances
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Always render, even if no instances (to clear the screen)
        if (astroidInstances.length > 0) {
          if (Math.random() < 0.01) {
            console.log(
              "[Astroid] Rendering",
              astroidInstances.length,
              "instances at time",
              currentTimeSec.toFixed(3),
              "isPlaying:",
              curIsPlaying
            );
          }
          gl.useProgram(programRef.current);

          if (resolutionLocation) {
            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
          }
          if (devicePixelRatioLocation) {
            gl.uniform1f(devicePixelRatioLocation, getDevicePixelRatio());
          }
          if (glowRadiusLocation) {
            gl.uniform1f(glowRadiusLocation, 10.0);
          }
          if (glowSpreadLocation) {
            gl.uniform1f(glowSpreadLocation, 2.0);
          }
          if (glowColorLocation) {
            gl.uniform3f(glowColorLocation, 0.996, 0.996, 0.318);
          }

          // Generate geometry once (all instances use same size)
          // Use first instance or defaults
          const firstInstance = astroidInstances[0];
          const baseRadius = firstInstance?.baseRadius || 2;
          const height = firstInstance?.height || 5;
          const whiteRadiusRatio = firstInstance?.whiteRadiusRatio || 0.6;
          const yellowRadiusRatio = firstInstance?.yellowRadiusRatio || 0.4;

          const geometry = generateConeGeometry(
            baseRadius,
            height,
            whiteRadiusRatio,
            yellowRadiusRatio
          );

          const positionArray = new Float32Array(geometry.vertices);
          const coneTypeArray = new Float32Array(geometry.coneTypes);
          const indexArray = new Uint16Array(geometry.indices);

          // Upload geometry once
          gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.position);
          gl.bufferData(gl.ARRAY_BUFFER, positionArray, gl.STATIC_DRAW);
          gl.enableVertexAttribArray(positionLocation);
          gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.coneType);
          gl.bufferData(gl.ARRAY_BUFFER, coneTypeArray, gl.STATIC_DRAW);
          gl.enableVertexAttribArray(coneTypeLocation);
          gl.vertexAttribPointer(coneTypeLocation, 1, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffersRef.current.index);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);

          // Render each astroid instance
          for (const instance of astroidInstances) {
            // Set uniforms for this instance
            if (scaleLocation) {
              gl.uniform1f(scaleLocation, instance.scale);
            }
            if (baseRadiusLocation) {
              gl.uniform1f(baseRadiusLocation, instance.baseRadius);
            }
            if (heightLocation) {
              gl.uniform1f(heightLocation, instance.height);
            }
            if (whiteRadiusRatioLocation) {
              gl.uniform1f(whiteRadiusRatioLocation, instance.whiteRadiusRatio);
            }
            if (yellowRadiusRatioLocation) {
              gl.uniform1f(
                yellowRadiusRatioLocation,
                instance.yellowRadiusRatio
              );
            }
            if (rotateXLocation) {
              gl.uniform1f(rotateXLocation, instance.rotateX);
            }
            if (rotateYLocation) {
              gl.uniform1f(rotateYLocation, instance.rotateY);
            }
            if (rotateZLocation) {
              gl.uniform1f(rotateZLocation, instance.rotateZ);
            }
            if (bendAngleLocation) {
              gl.uniform1f(bendAngleLocation, instance.bendAngle);
            }
            if (positionOffsetLocation) {
              // The shader uses side-view projection: X from Z depth, Y from cone Y
              // screenPos is in object space pixels, then multiplied by DPR in shader
              // Shader now centers by adding resolution/2, so we need offset from center
              // Anchor center is in device pixels, canvas resolution is in device pixels
              const dpr = getDevicePixelRatio();
              const canvasCenterX = canvas.width / 2; // Device pixels
              const canvasCenterY = canvas.height / 2; // Device pixels
              // Convert to screen coordinates (CSS pixels) for the offset uniform
              const offsetX = (instance.x - canvasCenterX) / dpr;
              const offsetY = (instance.y - canvasCenterY) / dpr;
              gl.uniform2f(positionOffsetLocation, offsetX, offsetY);

              if (Math.random() < 0.01) {
                console.log("[Astroid] Position offset:", {
                  offsetX,
                  offsetY,
                  canvasW: canvas.width,
                  canvasH: canvas.height,
                  dpr,
                  instanceX: instance.x,
                  instanceY: instance.y,
                  canvasCenterX,
                  canvasCenterY,
                });
              }
            }

            gl.drawElements(
              gl.TRIANGLES,
              geometry.indices.length,
              gl.UNSIGNED_SHORT,
              0
            );
          }
        }

        // Animation complete check removed for single astroid
      };

      // Always start the animation loop
      animationIdRef.current = requestAnimationFrame(animate);

      return () => {
        window.removeEventListener("resize", resizeCanvas);
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
          animationIdRef.current = null;
        }
        const gl = glRef.current;
        if (gl) {
          Object.values(buffersRef.current).forEach((buffer) => {
            if (buffer) gl.deleteBuffer(buffer);
          });
          if (vertexShader) {
            gl.deleteShader(vertexShader);
          }
          if (fragmentShader) {
            gl.deleteShader(fragmentShader);
          }
          if (programRef.current) {
            gl.deleteProgram(programRef.current);
          }
        }
      };
    } catch (error) {
      return () => {};
    }
  }, [anchorEl]); // Only depend on anchorEl, not isPlaying/scrubTime to avoid recreating WebGL context

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
