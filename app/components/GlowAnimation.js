"use client";

import { useEffect, useRef } from "react";
import { drawSpark, disposeSpark } from "./animation/Spark";
import { DEFAULT_CONFIG } from "./animation/constants";
import { getAngleForVertex } from "./animation/utils";
import { CAMERA_DISTANCE } from "./animation/constants";

export default function GlowAnimation({
  anchorEl,
  config = {},
  isPlaying = false,
  onAnimationComplete,
}) {
  const canvasRef = useRef(null);
  const startTimeRef = useRef(null);
  const animationIdRef = [];
  const glRef = useRef(null);
  const positionBufferRef = useRef(null);
  const pathMetricsRef = useRef(new Map()); // key: path.id -> { pathLength, thetaEndLocal, rotAngle, dir, centerX, centerY, a, b, cam, tiltX, tiltY, depthAmp, depthPhase, rotExtra }
  const statusRef = useRef(new Map());

  const delayToSeconds = (v) => (typeof v === "number" && !Number.isNaN(v) ? (v > 20 ? v / 1000 : v) : 0);
  const degToRad = (d) => (d * Math.PI) / 180;

  // Compute arc length along rotated ellipse with perspective (includes center translation and tilt), matching shader
  const computePathLength = (a, b, rotAngle, rotExtra, thetaStart, thetaEnd, centerX, centerY, camDist, tiltX, tiltY, depthAmp, depthPhase) => {
    const SAMPLES = 128;
    const baseRot = rotAngle + rotExtra;
    const c = Math.cos(baseRot);
    const s = Math.sin(baseRot);
    const cx = Math.cos(tiltX), sx = Math.sin(tiltX);
    const cy = Math.cos(tiltY), sy = Math.sin(tiltY);

    const project = (lx, ly, th) => {
      const rx = c * lx - s * ly;
      const ry = s * lx + c * ly;
      const rz = depthAmp * Math.sin(th + depthPhase);
      // tilt X
      const tx = rx;
      const ty = cx * ry - sx * rz;
      const tz = sx * ry + cx * rz;
      // tilt Y
      const ux = cy * tx + sy * tz;
      const uy = ty;
      const uz = -sy * tx + cy * tz;
      const px = (centerX + ux) / (1 + uz / camDist);
      const py = (centerY + uy) / (1 + uz / camDist);
      return [px, py];
    };

    let lx0 = a * Math.cos(thetaStart);
    let ly0 = b * Math.sin(thetaStart);
    let [px0, py0] = project(lx0, ly0, thetaStart);
    let total = 0;
    let ppx = px0;
    let ppy = py0;
    for (let i = 1; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const th = thetaStart + (thetaEnd - thetaStart) * t;
      const lx = a * Math.cos(th);
      const ly = b * Math.sin(th);
      const [px, py] = project(lx, ly, th);
      total += Math.hypot(px - ppx, py - ppy);
      ppx = px;
      ppy = py;
    }
    return total;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }
    glRef.current = gl;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Full-screen quad
    const positionBuffer = gl.createBuffer();
    positionBufferRef.current = positionBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0, 0,
        canvas.width, 0,
        0, canvas.height,
        0, canvas.height,
        canvas.width, 0,
        canvas.width, canvas.height,
      ]),
      gl.STATIC_DRAW
    );

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const animate = () => {
      if (!isPlaying) {
        animationIdRef[0] = null;
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }

      const currentTimeMs = performance.now() - startTimeRef.current;
      const currentTimeSec = currentTimeMs / 1000.0;

      // Determine anchor center in screen coords
      let centerX = canvas.width / 2;
      let centerY = canvas.height / 2;
      if (anchorEl?.getBoundingClientRect) {
        const rect = anchorEl.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
      }

      // Merge config and active paths
      const cfg = { ...DEFAULT_CONFIG, ...config };
      const activePaths = (cfg.paths || []).filter((p) => p.enabled !== false);

      // Ensure metrics exist and are up to date for all active paths
      for (const p of activePaths) {
        const ellipse = p.ellipse || cfg.ellipse;
        const startDir = getAngleForVertex(p.startVertex);
        const endDir = getAngleForVertex(p.endVertex);
        let delta = ((endDir - startDir + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; // (-pi,pi]
        let dir = Math.sign(delta) || 1;
        const thetaStartLocal = 0.0;
        const thetaEndLocal = Math.abs(delta || Math.PI);
        const rotAngle = startDir;

        const cam = p.cameraDistance ?? cfg.cameraDistance ?? CAMERA_DISTANCE;
        const tiltX = degToRad(p.viewTiltXDeg ?? cfg.viewTiltXDeg ?? 0);
        const tiltY = degToRad(p.viewTiltYDeg ?? cfg.viewTiltYDeg ?? 0);
        const depthAmp = p.depthAmplitude ?? cfg.depthAmplitude ?? 100;
        const depthPhase = degToRad(p.depthPhaseDeg ?? cfg.depthPhaseDeg ?? 0);
        const rotExtra = degToRad(p.ellipseRotationDeg ?? 0);

        const prev = pathMetricsRef.current.get(p.id);
        if (
          !prev ||
          prev.centerX !== centerX ||
          prev.centerY !== centerY ||
          prev.a !== ellipse.a ||
          prev.b !== ellipse.b ||
          prev.thetaEndLocal !== thetaEndLocal ||
          prev.rotAngle !== rotAngle ||
          prev.dir !== dir ||
          prev.cam !== cam ||
          prev.tiltX !== tiltX ||
          prev.tiltY !== tiltY ||
          prev.depthAmp !== depthAmp ||
          prev.depthPhase !== depthPhase ||
          prev.rotExtra !== rotExtra
        ) {
          const pathLength = computePathLength(
            ellipse.a,
            ellipse.b,
            rotAngle,
            rotExtra,
            thetaStartLocal,
            thetaEndLocal,
            centerX,
            centerY,
            cam,
            tiltX,
            tiltY,
            depthAmp,
            depthPhase
          );
          pathMetricsRef.current.set(p.id, {
            pathLength,
            thetaEndLocal,
            rotAngle,
            dir,
            centerX,
            centerY,
            a: ellipse.a,
            b: ellipse.b,
            cam,
            tiltX,
            tiltY,
            depthAmp,
            depthPhase,
            rotExtra,
          });
          console.log("[SparkMetrics] recomputed", {
            id: p.id,
            centerX,
            centerY,
            a: ellipse.a,
            b: ellipse.b,
            rotAngle,
            rotExtra,
            thetaEndLocal,
            cam,
            tiltX,
            tiltY,
            depthAmp,
            depthPhase,
            pathLength,
          });
        }
      }

      // Determine if all paths completed (tail reached end)
      let allComplete = activePaths.length > 0;
      const animationTimeMsGlobal = cfg.animationTimeMs ?? DEFAULT_CONFIG.animationTimeMs;

      for (const p of activePaths) {
        const delayRaw = p.delay || 0;
        const delaySec = delayToSeconds(delayRaw);
        const durationSec = (p.animationTimeMs ?? animationTimeMsGlobal) / 1000.0;
        const rawPhase = (currentTimeSec - delaySec) / Math.max(durationSec, 0.0001);

        const metrics = pathMetricsRef.current.get(p.id);
        const lineLength = p.length ?? cfg.length ?? 300.0;
        const pathLength = metrics?.pathLength || 1.0;
        const segmentParam = lineLength / Math.max(pathLength, 0.0001);
        const maxPhase = 1.0 + segmentParam; // run until tail reaches end

        // Status transitions for debugging
        let status = statusRef.current.get(p.id) || "pending";
        let nextStatus = status;
        if (rawPhase < 0) nextStatus = "pending";
        else if (rawPhase < 1.0) nextStatus = "running";
        else if (rawPhase < maxPhase) nextStatus = "head_done";
        else nextStatus = "complete";
        if (nextStatus !== status) {
          statusRef.current.set(p.id, nextStatus);
          console.log("[SparkStatus]", {
            id: p.id,
            delayRaw,
            delaySec,
            nowMs: Math.round(currentTimeMs),
            rawPhase: rawPhase.toFixed(3),
            segmentParam: segmentParam.toFixed(3),
            maxPhase: maxPhase.toFixed(3),
            status: nextStatus,
          });
        }

          if (rawPhase < maxPhase) {
          allComplete = false;
        }
      }

      if (allComplete && activePaths.length > 0) {
        animationIdRef[0] = null;
        gl.clear(gl.COLOR_BUFFER_BIT);
        console.log("[Animation] complete all paths at", Math.round(currentTimeMs), "ms");
        if (onAnimationComplete) onAnimationComplete();
        return;
      }

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current);

      // Render each spark/path
      activePaths.forEach((path) => {
        drawSpark({
          gl,
          canvas,
          anchorCenter: [centerX, centerY],
          timeNowSec: currentTimeSec,
          globalConfig: cfg,
          pathConfig: path,
        });
      });

      animationIdRef[0] = requestAnimationFrame(animate);
    };

    if (isPlaying && !animationIdRef[0]) {
      startTimeRef.current = performance.now();
      console.log("[Animation] start", { startAtMs: Math.round(startTimeRef.current) });
      statusRef.current = new Map();
      animationIdRef[0] = requestAnimationFrame(animate);
    } else if (!isPlaying && animationIdRef[0]) {
      cancelAnimationFrame(animationIdRef[0]);
      animationIdRef[0] = null;
      gl.clear(gl.COLOR_BUFFER_BIT);
      console.log("[Animation] stopped by user");
    }

    return () => {
      if (animationIdRef[0]) {
        cancelAnimationFrame(animationIdRef[0]);
        animationIdRef[0] = null;
      }
      window.removeEventListener("resize", resizeCanvas);
      if (positionBufferRef.current) {
        gl.deleteBuffer(positionBufferRef.current);
        positionBufferRef.current = null;
      }
      if (glRef.current) {
        try {
          disposeSpark(glRef.current);
        } catch {}
      }
      console.log("[Animation] cleanup");
    };
  }, [anchorEl, config, isPlaying, onAnimationComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
}


