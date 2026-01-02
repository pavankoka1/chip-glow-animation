"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import {
  createProgram,
  createShader,
  getDevicePixelRatio,
} from "./utils/webglUtils";
import { fragmentShaderSource, vertexShaderSource } from "./CircleSparkWebGL/shaders";

// Context for sharing WebGL resources
const SharedWebGLContext = createContext(null);

export function useSharedWebGL() {
  const context = useContext(SharedWebGLContext);
  if (!context) {
    throw new Error("useSharedWebGL must be used within SharedWebGLProvider");
  }
  return context;
}

/**
 * Shared WebGL Context Provider for webgl-layers
 * Manages a single WebGL context that all animation components share
 */
export function SharedWebGLProvider({ children }) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const animationIdRef = useRef(null);
  const lastTsRef = useRef(null);

  // WebGL resources (shared across all animations)
  const shadersRef = useRef({ vertex: null, fragment: null });
  const attribsRef = useRef({});
  const uniformsRef = useRef({});
  const buffersRef = useRef({});
  const bufferDataRef = useRef({ maxPoints: 0 });

  // Registry of all active animations
  const animationRegistryRef = useRef(new Map());
  const cleanupRef = useRef(null);

  // Register/unregister animations
  const registerAnimation = useRef((id, data) => {
    animationRegistryRef.current.set(id, data);
  });

  const unregisterAnimation = useRef((id) => {
    animationRegistryRef.current.delete(id);
  });

  // Initialize WebGL context
  useEffect(() => {
    // First, test if WebGL is supported at all
    const testCanvas = document.createElement("canvas");
    const testGl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
    if (!testGl) {
      console.error("WebGL is not supported in this browser");
      return;
    }

    let retryCount = 0;
    const maxRetries = 10;
    
    // Wait for canvas to be mounted in DOM
    const checkCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        requestAnimationFrame(checkCanvas);
        return;
      }

      // Set initial dimensions before getting context (some browsers require this)
      const dpr = getDevicePixelRatio();
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Try to get WebGL context - you can only get it once per canvas!
      let gl = null;
      try {
        gl = canvas.getContext("webgl", {
          alpha: true,
          premultipliedAlpha: false,
          antialias: true,
        });
      } catch (e) {
        console.warn("Error getting webgl context:", e);
      }

      if (!gl) {
        // Try experimental-webgl
        try {
          gl = canvas.getContext("experimental-webgl", {
            alpha: true,
            premultipliedAlpha: false,
            antialias: true,
          });
        } catch (e) {
          console.warn("Error getting experimental-webgl context:", e);
        }
      }

      if (!gl) {
        // Try webgl2 as fallback
        try {
          gl = canvas.getContext("webgl2", {
            alpha: true,
            premultipliedAlpha: false,
            antialias: true,
          });
        } catch (e) {
          console.warn("Error getting webgl2 context:", e);
        }
      }

      if (!gl) {
        retryCount++;
        if (retryCount < maxRetries) {
          // Wait a bit before retrying
          setTimeout(() => requestAnimationFrame(checkCanvas), 100);
          return;
        } else {
          console.error("WebGL not supported after", maxRetries, "retries - canvas:", canvas, "isConnected:", canvas?.isConnected, "dimensions:", canvas.width, "x", canvas.height);
          console.error("Test canvas WebGL support:", !!testGl);
          return;
        }
      }

      glRef.current = gl;

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
          alpha: gl.getAttribLocation(program, "a_alpha"),
          along01: gl.getAttribLocation(program, "a_along01"),
          glowRadius: gl.getAttribLocation(program, "a_glowRadius"),
        };

        uniformsRef.current = {
          resolution: gl.getUniformLocation(program, "u_resolution"),
          devicePixelRatio: gl.getUniformLocation(program, "u_devicePixelRatio"),
          whiteCenterRatio: gl.getUniformLocation(program, "u_whiteCenterRatio"),
          glowOpacity: gl.getUniformLocation(program, "u_glowOpacity"),
          whiteCoverage: gl.getUniformLocation(program, "u_whiteCoverage"),
          headTaperRatio: gl.getUniformLocation(program, "u_headTaperRatio"),
          headCurve: gl.getUniformLocation(program, "u_headCurve"),
        };

        buffersRef.current = {
          position: gl.createBuffer(),
          radius: gl.createBuffer(),
          sparkColor: gl.createBuffer(),
          alpha: gl.createBuffer(),
          along01: gl.createBuffer(),
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

      // Main animation loop - renders all registered animations
      const animate = (ts) => {
        if (lastTsRef.current == null) lastTsRef.current = ts;
        const dtSec = Math.min(0.05, (ts - lastTsRef.current) / 1000);
        lastTsRef.current = ts;

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Collect all points from all registered animations
        const allPoints = [];
        const registry = animationRegistryRef.current;

        if (registry.size === 0) {
          animationIdRef.current = requestAnimationFrame(animate);
          return;
        }

        for (const [id, animationData] of registry) {
          const {
            generatePoints,
            calculateMetrics,
            isPlayingRef,
            anchorEls, // Array of { element, delay, anchorRectRef, anchorCenterRef, startTimeRef }
            pathConfig,
            globalConfig,
          } = animationData;

          const isPlaying = isPlayingRef?.current || false;

          // Skip if not playing
          if (!isPlaying) {
            continue;
          }

          // Process each anchorEl for this animation
          if (!anchorEls || anchorEls.length === 0) {
            continue;
          }

          const currentTime = performance.now();

          for (const anchorElData of anchorEls) {
            const {
              delay,
              anchorRectRef,
              anchorCenterRef,
              startTimeRef,
            } = anchorElData;

            const startTime = startTimeRef?.current;

            // Skip if this anchorEl hasn't started
            if (!startTime) {
              continue;
            }

            const elapsed = currentTime - startTime;
            const delayMs = delay || 0;

            // Skip if in delay period
            if (elapsed < delayMs) {
              continue;
            }

            const adjustedElapsed = elapsed - delayMs;
            const durationMs = pathConfig?.animationTimeMs || 0;
            const normalizedTime = Math.min(1.0, adjustedElapsed / durationMs);

            // Calculate metrics if needed
            if (!anchorRectRef?.current) {
              continue;
            }

            // Calculate metrics for this specific anchorEl
            const metrics = calculateMetrics?.(anchorRectRef, anchorCenterRef);
            if (!metrics) {
              continue;
            }

            // Generate points for this anchorEl
            const points = generatePoints?.(metrics, normalizedTime, anchorCenterRef, anchorRectRef);
            if (points && points.length > 0) {
              allPoints.push(...points);
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
            bufferDataRef.current.col = new Float32Array(count * 3);
            bufferDataRef.current.alp = new Float32Array(count);
            bufferDataRef.current.along = new Float32Array(count);
            bufferDataRef.current.glowRad = new Float32Array(count);
          }

          const { pos, rad, col, alp, along, glowRad } = bufferDataRef.current;
          const dpr = getDevicePixelRatio();

          for (let i = 0; i < count; i++) {
            const p = allPoints[i];
            // Points are already in screen coordinates (x, y include anchor offset)
            pos[i * 2] = p.x;
            pos[i * 2 + 1] = p.y;
            rad[i] = p.radius;
            col[i * 3] = p.color[0];
            col[i * 3 + 1] = p.color[1];
            col[i * 3 + 2] = p.color[2];
            alp[i] = p.alpha;
            along[i] = p.along01;
            glowRad[i] = p.glowRadius;
          }

          // Use the first animation's config for uniforms (they should all be similar)
          const firstAnimation = Array.from(registry.values())[0];
          const pathConfig = firstAnimation?.pathConfig || {};
          const globalConfig = firstAnimation?.globalConfig || {};

          gl.useProgram(program);
          gl.uniform2f(
            uniformsRef.current.resolution,
            canvas.width,
            canvas.height
          );
          gl.uniform1f(uniformsRef.current.devicePixelRatio, dpr);
          gl.uniform1f(
            uniformsRef.current.whiteCenterRatio,
            pathConfig.whiteCenterRatio ?? globalConfig.whiteCenterRatio ?? 0.8
          );
          gl.uniform1f(
            uniformsRef.current.glowOpacity,
            pathConfig.glowOpacity ?? globalConfig.glowOpacity ?? 0.15
          );
          gl.uniform1f(
            uniformsRef.current.whiteCoverage,
            pathConfig.whiteCoverage ?? globalConfig.whiteCoverage ?? 0.92
          );
          gl.uniform1f(
            uniformsRef.current.headTaperRatio,
            pathConfig.headTaperRatio ?? globalConfig.headTaperRatio ?? 0.08
          );
          gl.uniform1f(
            uniformsRef.current.headCurve,
            pathConfig.headCurve ?? globalConfig.headCurve ?? 0.2
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
            col.subarray(0, count * 3),
            gl.DYNAMIC_DRAW
          );
          gl.enableVertexAttribArray(a.sparkColor);
          gl.vertexAttribPointer(a.sparkColor, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, b.alpha);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            alp.subarray(0, count),
            gl.DYNAMIC_DRAW
          );
          gl.enableVertexAttribArray(a.alpha);
          gl.vertexAttribPointer(a.alpha, 1, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, b.along01);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            along.subarray(0, count),
            gl.DYNAMIC_DRAW
          );
          gl.enableVertexAttribArray(a.along01);
          gl.vertexAttribPointer(a.along01, 1, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, b.glowRadius);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            glowRad.subarray(0, count),
            gl.DYNAMIC_DRAW
          );
          gl.enableVertexAttribArray(a.glowRadius);
          gl.vertexAttribPointer(a.glowRadius, 1, gl.FLOAT, false, 0, 0);

          gl.drawArrays(gl.POINTS, 0, count);
        }

        animationIdRef.current = requestAnimationFrame(animate);
      };

        animationIdRef.current = requestAnimationFrame(animate);

        // Store cleanup function
        cleanupRef.current = () => {
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
          animationRegistryRef.current.clear();
        };
      } catch (e) {
        console.error("WebGL error:", e);
      }
    };

    // Start checking for canvas
    checkCanvas();

    // Return cleanup function
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const contextValue = {
    registerAnimation: (id, data) => registerAnimation.current(id, data),
    unregisterAnimation: (id) => unregisterAnimation.current(id),
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 10000 }}
      />
      <SharedWebGLContext.Provider value={contextValue}>
        {children}
      </SharedWebGLContext.Provider>
    </>
  );
}

