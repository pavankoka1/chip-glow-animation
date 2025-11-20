"use client";

import { useEffect, useRef } from "react";
import useFps from "../hooks/useFps";
import { disposeSpark, drawSpark } from "./animation/Spark";
import {
  computeCirclePathLength,
  disposeSparkCircle,
  drawSparkCircle,
} from "./animation/SparkCircle";
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

  const applyEasingSpark = (t) => {
    const t1 = 1 - t;
    return 1 - Math.pow(t1, 2.25);
  };

  const applyEasingCircle = (t) => {
    return Math.pow(t, 1.5);
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
    depthPhase,
    ellipseTiltDeg
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
      let p = [rx, ry, rz];

      const ellipseTiltRad = ((90 - ellipseTiltDeg) * Math.PI) / 180;

      const majorAxis = [c, s, 0];
      const axisLen = Math.hypot(majorAxis[0], majorAxis[1], majorAxis[2]);
      if (axisLen > 0.0001) {
        const normalizedAxis = [
          majorAxis[0] / axisLen,
          majorAxis[1] / axisLen,
          majorAxis[2] / axisLen,
        ];

        const ct = Math.cos(ellipseTiltRad);
        const st = Math.sin(ellipseTiltRad);
        const oneMinusCt = 1 - ct;

        const m00 = ct + normalizedAxis[0] * normalizedAxis[0] * oneMinusCt;
        const m01 =
          normalizedAxis[0] * normalizedAxis[1] * oneMinusCt -
          normalizedAxis[2] * st;
        const m02 =
          normalizedAxis[0] * normalizedAxis[2] * oneMinusCt +
          normalizedAxis[1] * st;
        const m10 =
          normalizedAxis[1] * normalizedAxis[0] * oneMinusCt +
          normalizedAxis[2] * st;
        const m11 = ct + normalizedAxis[1] * normalizedAxis[1] * oneMinusCt;
        const m12 =
          normalizedAxis[1] * normalizedAxis[2] * oneMinusCt -
          normalizedAxis[0] * st;
        const m20 =
          normalizedAxis[2] * normalizedAxis[0] * oneMinusCt -
          normalizedAxis[1] * st;
        const m21 =
          normalizedAxis[2] * normalizedAxis[1] * oneMinusCt +
          normalizedAxis[0] * st;
        const m22 = ct + normalizedAxis[2] * normalizedAxis[2] * oneMinusCt;

        p = [
          m00 * p[0] + m01 * p[1] + m02 * p[2],
          m10 * p[0] + m11 * p[1] + m12 * p[2],
          m20 * p[0] + m21 * p[1] + m22 * p[2],
        ];

        const tiltOffsetAmount = (ellipseTiltDeg / 90.0) * b * 0.3;

        const perpendicularDir = [-normalizedAxis[1], normalizedAxis[0]];
        p[0] += perpendicularDir[0] * tiltOffsetAmount;
        p[1] += perpendicularDir[1] * tiltOffsetAmount;
      }

      const tx = p[0];
      const ty = cx * p[1] - sx * p[2];
      const tz = sx * p[1] + cx * p[2];
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
        const isCirclePath =
          p.type === "circle" || p.circleRadius !== undefined;

        if (isCirclePath) {
          const circleRadius = p.circleRadius ?? 30;

          let autoA;
          if (rect) {
            const diagonal = Math.hypot(rect.width, rect.height);
            autoA = diagonal / 2;
          } else {
            autoA = 141.4214;
          }

          const bVal = circleRadius;

          const startVertex = p.startVertex || "BR";

          const dynamicRotAngle =
            startVertex === "BR" || startVertex === "TL"
              ? (135 * Math.PI) / 180
              : (45 * Math.PI) / 180;

          const prev = pathMetricsRef.current.get(p.id);
          if (
            !prev ||
            prev.centerX !== centerX ||
            prev.centerY !== centerY ||
            prev.a !== autoA ||
            prev.b !== bVal ||
            prev.rotAngle !== dynamicRotAngle ||
            prev.circleRadius !== circleRadius ||
            prev.startVertex !== startVertex ||
            prev.isCircle !== true
          ) {
            const pathResult = computeCirclePathLength(
              autoA,
              bVal,
              dynamicRotAngle,
              centerX,
              centerY,
              circleRadius,
              rect,
              startVertex
            );
            pathMetricsRef.current.set(p.id, {
              pathLength: pathResult.pathLength,
              startTheta: pathResult.startTheta,
              meetingTheta: pathResult.meetingTheta,
              rotAngle: dynamicRotAngle,
              ellipsePortion: pathResult.ellipsePortion,
              circlePortion: pathResult.circlePortion,
              meetingCircleAngle: pathResult.meetingCircleAngle,
              centerX,
              centerY,
              a: autoA,
              b: bVal,
              circleRadius,
              startVertex,
              isCircle: true,
            });
          }
        } else {
          if (!p.startVertex || !p.endVertex) {
            continue;
          }
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
          const depthPhase = degToRad(
            p.depthPhaseDeg ?? cfg.depthPhaseDeg ?? 0
          );
          const rotExtra = degToRad(p.ellipseRotationDeg ?? 0);
          const ellipseTiltDeg = p.ellipseTiltDeg ?? cfg.ellipseTiltDeg ?? 0;

          const ellipseCfg = p.ellipse || cfg.ellipse;
          let autoA = ellipseCfg?.a;
          let bVal = ellipseCfg?.b ?? 0.0;
          if (rect && autoA === undefined) {
            const diagonal = Math.hypot(rect.width, rect.height);
            autoA = diagonal / 2;
          } else if (autoA === undefined) {
            autoA = 150;
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
            prev.rotExtra !== rotExtra ||
            prev.ellipseTiltDeg !== ellipseTiltDeg ||
            prev.isCircle === true
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
              depthPhase,
              ellipseTiltDeg
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
              ellipseTiltDeg,
              isCircle: false,
            });
          }
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

        const normalizedTime = Math.min(
          1.0,
          Math.max(0.0, elapsed / Math.max(durationSec, 0.0001))
        );

        let easedNormalizedTime = applyEasingSpark(normalizedTime);

        if (normalizedTime >= 1.0) {
          easedNormalizedTime = 1.0;
        }

        const scaledPhase = easedNormalizedTime * totalSpan;
        const completeThreshold = totalSpan + fadeWindow;

        const fadeWindowDuration = (fadeWindow / totalSpan) * durationSec;
        const totalDuration = durationSec + fadeWindowDuration;

        const isPathComplete =
          elapsed >= totalDuration || scaledPhase >= completeThreshold - 0.0001;

        if (!isPathComplete) {
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
        const isCirclePath =
          path.type === "circle" || path.circleRadius !== undefined;

        const delayRaw = path.delay || 0;
        const delaySec = delayToSeconds(delayRaw);
        const durationSec =
          (path.animationTimeMs ?? animationTimeMsGlobal) / 1000.0;
        const elapsed = Math.max(0, currentTimeSec - delaySec);
        const normalizedTime = Math.min(
          1.0,
          Math.max(0.0, elapsed / Math.max(durationSec, 0.0001))
        );

        let easedNormalizedTime = isCirclePath
          ? applyEasingCircle(normalizedTime)
          : applyEasingSpark(normalizedTime);

        if (normalizedTime >= 1.0) {
          easedNormalizedTime = 1.0;
        }

        const metrics = pathMetricsRef.current.get(path.id);
        const pathLength = metrics?.pathLength || 1.0;

        if (isCirclePath) {
          const circleRadius = path.circleRadius ?? 30;

          let autoA;
          if (rect) {
            const diagonal = Math.hypot(rect.width, rect.height);
            autoA = diagonal / 2;
          } else {
            autoA = 141.4214;
          }

          const bVal = circleRadius;

          const pathWithAutoEllipse = {
            ...path,
            ellipse: { ...(path.ellipse || {}), a: autoA, b: bVal },
          };

          const metrics = pathMetricsRef.current.get(path.id);
          drawSparkCircle({
            gl,
            canvas,
            anchorCenter: [centerX, centerY],
            timeNowSec: currentTimeSec,
            globalConfig: cfg,
            pathConfig: pathWithAutoEllipse,
            easedNormalizedTime,
            totalArcPx: metrics?.pathLength || pathLength,
            startTheta: metrics?.startTheta ?? 0,
            meetingTheta: metrics?.meetingTheta ?? 0,
            rotAngle: metrics?.rotAngle,
            ellipsePortion: metrics?.ellipsePortion,
            circlePortion: metrics?.circlePortion,
            meetingCircleAngle: metrics?.meetingCircleAngle,
          });
        } else {
          const ellipseCfg = path.ellipse || cfg.ellipse;
          let autoA = ellipseCfg?.a;
          let bVal = ellipseCfg?.b ?? 0.0;
          if (rect && autoA === undefined) {
            const diagonal = Math.hypot(rect.width, rect.height);
            autoA = 10 + diagonal / 2;
          } else if (autoA === undefined) {
            autoA = 150;
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
            easedNormalizedTime,
            totalArcPx: pathLength,
          });
        }
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
          disposeSparkCircle(glRef.current);
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
