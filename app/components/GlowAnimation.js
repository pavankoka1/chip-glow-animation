"use client";

import { useEffect, useRef } from "react";
import useFps from "../hooks/useFps";
import { disposeSpark, drawSpark } from "./animation/Spark";
import { CAMERA_DISTANCE, DEFAULT_CONFIG } from "./animation/constants";
import { getAngleForVertex } from "./animation/utils";

export default function GlowAnimation({
  anchorEl,
  config = {},
  isPlaying = false,
  onAnimationComplete,
}) {
  const canvasRef = useRef(null);
  const animationIdRef = [];
  const glRef = useRef(null);
  const positionBufferRef = useRef(null);
  const pathMetricsRef = useRef(new Map());
  const lastTsRef = useRef(null);
  const accumulatedSecRef = useRef(0);
  useFps({ sampleSize: 90 });

  const delayToSeconds = (v) =>
    typeof v === "number" && !Number.isNaN(v) ? (v > 20 ? v / 1000 : v) : 0;
  const degToRad = (d) => (d * Math.PI) / 180;

  const cornerPoint = (vertex, rect) => {
    switch (vertex) {
      case "TL":
        return [rect.left, rect.top];
      case "TR":
        return [rect.right, rect.top];
      case "BR":
        return [rect.right, rect.bottom];
      case "BL":
        return [rect.left, rect.bottom];
      default:
        return [rect.right, rect.top];
    }
  };

  const computePathLength = (
    a,
    b,
    rotAngle,
    rotExtra,
    thetaStart,
    thetaEnd,
    centerX,
    centerY,
    camDist,
    tiltX,
    tiltY,
    depthAmp,
    depthPhase
  ) => {
    const SAMPLES = 128;
    const baseRot = rotAngle + rotExtra;
    const c = Math.cos(baseRot);
    const s = Math.sin(baseRot);
    const cx = Math.cos(tiltX),
      sx = Math.sin(tiltX);
    const cy = Math.cos(tiltY),
      sy = Math.sin(tiltY);

    const project = (lx, ly, th) => {
      const rx = c * lx - s * ly;
      const ry = s * lx + c * ly;
      const rz = depthAmp * Math.sin(th + depthPhase);
      const tx = rx;
      const ty = cx * ry - sx * rz;
      const tz = sx * ry + cx * rz;
      const ux = cy * tx + sy * tz;
      const uy = ty;
      const uz = -sy * tx + cy * tz;
      const px = (centerX + ux) / (1 + uz / camDist);
      const py = (centerY + uy) / (1 + uz / camDist);
      return [px, py];
    };

    let [px0, py0] = project(
      a * Math.cos(thetaStart),
      b * Math.sin(thetaStart),
      thetaStart
    );
    let total = 0;
    for (let i = 1; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const th = thetaStart + (thetaEnd - thetaStart) * t;
      const [px, py] = project(a * Math.cos(th), b * Math.sin(th), th);
      total += Math.hypot(px - px0, py - py0);
      px0 = px;
      py0 = py;
    }
    return total;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
    });
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

    const positionBuffer = gl.createBuffer();
    positionBufferRef.current = positionBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0,
        0,
        canvas.width,
        0,
        0,
        canvas.height,
        0,
        canvas.height,
        canvas.width,
        0,
        canvas.width,
        canvas.height,
      ]),
      gl.STATIC_DRAW
    );

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const animate = (ts) => {
      if (!isPlaying) {
        animationIdRef[0] = null;
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }

      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dtSec = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      accumulatedSecRef.current += dtSec;

      const currentTimeSec = accumulatedSecRef.current;

      let centerX = canvas.width / 2;
      let centerY = canvas.height / 2;
      let rect = null;
      if (anchorEl?.getBoundingClientRect) {
        rect = anchorEl.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
      }

      const cfg = { ...DEFAULT_CONFIG, ...config };
      const activePaths = (cfg.paths || []).filter((p) => p.enabled !== false);

      for (const p of activePaths) {
        const ellipseCfg = p.ellipse || cfg.ellipse;
        const startDir = getAngleForVertex(p.startVertex);
        const endDir = getAngleForVertex(p.endVertex);
        let delta =
          ((((endDir - startDir + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) %
            (2 * Math.PI)) -
          Math.PI;
        let dir = Math.sign(delta) || 1;
        const thetaStartLocal = 0.0;
        const thetaEndLocal = Math.abs(delta || Math.PI);
        const rotAngle = startDir;

        const cam = p.cameraDistance ?? cfg.cameraDistance ?? CAMERA_DISTANCE;
        const tiltX = degToRad(p.viewTiltXDeg ?? cfg.viewTiltXDeg ?? 0);
        const tiltY = degToRad(p.viewTiltYDeg ?? cfg.viewTiltYDeg ?? 0);
        const depthAmp = p.depthAmplitude ?? cfg.depthAmplitude ?? 0;
        const depthPhase = degToRad(p.depthPhaseDeg ?? cfg.depthPhaseDeg ?? 0);
        const rotExtra = degToRad(p.ellipseRotationDeg ?? 0);

        let autoA = ellipseCfg?.a;
        let bVal = ellipseCfg?.b ?? 0.0;
        if (rect && autoA === undefined) {
          // Default: a = 10px + (diagonal / 2)
          const diagonal = Math.hypot(rect.width, rect.height);
          autoA = 10 + diagonal / 2;
          if (cfg.debug) {
            console.log("[AutoA Calculation]", {
              rectSize: `${rect.width}x${rect.height}`,
              diagonal: diagonal.toFixed(2),
              calculatedA: autoA.toFixed(2),
            });
          }
        } else if (autoA === undefined) {
          autoA = 150; // fallback if no rect and no config
        }

        const prev = pathMetricsRef.current.get(p.id);
        if (
          !prev ||
          prev.centerX !== centerX ||
          prev.centerY !== centerY ||
          prev.a !== autoA ||
          prev.b !== bVal ||
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
            autoA,
            bVal,
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
            a: autoA,
            b: bVal,
            cam,
            tiltX,
            tiltY,
            depthAmp,
            depthPhase,
            rotExtra,
          });
          if (cfg.debug)
            console.log("[SparkMetrics]", p.id, {
              a: autoA,
              b: bVal,
              pathLength,
            });
        }
      }

      let allComplete = activePaths.length > 0;
      const animationTimeMsGlobal =
        cfg.animationTimeMs ?? DEFAULT_CONFIG.animationTimeMs;

      for (const p of activePaths) {
        const delayRaw = p.delay || 0;
        const delaySec = delayToSeconds(delayRaw);
        const durationSec =
          (p.animationTimeMs ?? animationTimeMsGlobal) / 1000.0;
        const elapsed = Math.max(0, currentTimeSec - delaySec);

        const metrics = pathMetricsRef.current.get(p.id);
        const lineLength = p.length ?? cfg.length ?? 300.0;
        const pathLength = metrics?.pathLength || 1.0;
        const segmentParam = lineLength / Math.max(pathLength, 0.0001);
        const overshoot = p.overshoot ?? cfg.overshoot ?? 0.08;
        const fadeWindow = p.fadeWindow ?? cfg.fadeWindow ?? 0.08;
        const totalSpan = 1.0 + segmentParam + overshoot;

        // Scale phase so that full animation (including overshoot) fits into durationSec
        const scaledPhase =
          (elapsed / Math.max(durationSec, 0.0001)) * totalSpan;
        const completeThreshold = totalSpan + fadeWindow;

        if (scaledPhase < completeThreshold) {
          allComplete = false;
        }
      }

      if (allComplete && activePaths.length > 0) {
        animationIdRef[0] = null;
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (onAnimationComplete) onAnimationComplete();
        return;
      }

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current);

      for (const path of activePaths) {
        const ellipseCfg = path.ellipse || cfg.ellipse;
        let autoA = ellipseCfg?.a;
        let bVal = ellipseCfg?.b ?? 0.0;
        if (rect && autoA === undefined) {
          // Default: a = 10px + (diagonal / 2)
          const diagonal = Math.hypot(rect.width, rect.height);
          autoA = 10 + diagonal / 2;
        } else if (autoA === undefined) {
          autoA = 150; // fallback if no rect and no config
        }
        const pathWithAutoEllipse = {
          ...path,
          ellipse: { ...(path.ellipse || {}), a: autoA, b: bVal },
        };
        drawSpark({
          gl,
          canvas,
          anchorCenter: [centerX, centerY],
          timeNowSec: currentTimeSec,
          globalConfig: cfg,
          pathConfig: pathWithAutoEllipse,
        });
      }

      animationIdRef[0] = requestAnimationFrame(animate);
    };

    if (isPlaying && !animationIdRef[0]) {
      lastTsRef.current = null;
      accumulatedSecRef.current = 0;
      animationIdRef[0] = requestAnimationFrame(animate);
    } else if (!isPlaying && animationIdRef[0]) {
      cancelAnimationFrame(animationIdRef[0]);
      animationIdRef[0] = null;
      gl.clear(gl.COLOR_BUFFER_BIT);
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
    };
  }, [anchorEl, config, isPlaying, onAnimationComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
