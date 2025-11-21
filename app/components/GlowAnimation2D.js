"use client";

import { useEffect, useRef } from "react";
import useFps from "../hooks/useFps";
import { DEFAULT_CONFIG } from "./animation/constants";
import {
  computeCirclePathLength2D,
  computeLinePathLength2D,
  computeSparkPathLength2D,
  drawPath2D,
} from "./canvas2d/pathUtils";
import { getAngleForVertex } from "./canvas2d/utils";

export default function GlowAnimation2D({
  anchorEl,
  config = {},
  isPlaying = false,
  onAnimationComplete,
}) {
  const canvasRef = useRef(null);
  const animationIdRef = useRef(null);
  const lastTsRef = useRef(null);
  const accumulatedSecRef = useRef(0);
  const pathMetricsRef = useRef(new Map());
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

  const applyEasingLine = (t) => {
    // Smooth easing for line animation: ease-in-out cubic
    // This provides a natural acceleration and deceleration
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("2D canvas not supported");
      return;
    }

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const animate = (ts) => {
      if (!isPlaying) {
        animationIdRef.current = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
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

      // Compute path metrics for all paths
      for (const p of activePaths) {
        const isCirclePath =
          p.type === "circle" || p.circleRadius !== undefined;
        const isLinePath = p.type === "line";

        if (isLinePath) {
          // Line path: travel around BetSpot border
          const startPoint = p.startPoint ?? 0; // Start point in radians (360 = full round)
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
            const pathResult = computeLinePathLength2D(
              centerX,
              centerY,
              rect,
              startPoint, // Now accepts radians
              direction
            );
            pathMetricsRef.current.set(p.id, {
              pathLength: pathResult.pathLength,
              centerX,
              centerY,
              startPoint: pathResult.startPoint,
              direction: pathResult.direction,
              halfWidth: pathResult.halfWidth,
              halfHeight: pathResult.halfHeight,
              isLine: true,
              rectWidth: rect?.width,
              rectHeight: rect?.height,
            });
          }
        } else if (isCirclePath) {
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
          const direction = p.direction ?? cfg.direction ?? "clockwise"; // Get direction from config

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
            prev.direction !== direction ||
            prev.isCircle !== true
          ) {
            const pathResult = computeCirclePathLength2D(
              autoA,
              bVal,
              dynamicRotAngle,
              centerX,
              centerY,
              circleRadius,
              rect,
              startVertex,
              direction
            );
            pathMetricsRef.current.set(p.id, {
              pathLength: pathResult.pathLength,
              startTheta: pathResult.startTheta,
              meetingTheta: pathResult.meetingTheta,
              rotAngle: dynamicRotAngle,
              ellipsePortion: pathResult.ellipsePortion,
              circlePortion: pathResult.circlePortion,
              meetingCircleAngle: pathResult.meetingCircleAngle,
              direction: pathResult.direction,
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

          const direction = p.direction ?? cfg.direction ?? "auto"; // Get direction from config

          // If direction is explicitly set, override dir
          let finalDir = dir;
          if (direction === "anticlockwise") {
            finalDir = -1;
          } else if (direction === "clockwise") {
            finalDir = 1;
          }
          // If direction is "auto", use the calculated dir

          const thetaStartLocal = 0.0;
          // Make thetaEndLocal signed based on direction
          const thetaEndLocal = finalDir * Math.abs(delta || Math.PI);
          const rotAngle = startDir;

          const ellipseCfg = p.ellipse || cfg.ellipse;
          let autoA = ellipseCfg?.a;
          let bVal = ellipseCfg?.b ?? 0.0;
          if (rect && autoA === undefined) {
            const diagonal = Math.hypot(rect.width, rect.height);
            autoA = 10 + diagonal / 2;
          } else if (autoA === undefined) {
            autoA = 150;
          }

          const ellipseTiltDeg = p.ellipseTiltDeg ?? cfg.ellipseTiltDeg ?? 0;
          const ellipseRotationDeg =
            p.ellipseRotationDeg ?? cfg.ellipseRotationDeg ?? 0;

          const prev = pathMetricsRef.current.get(p.id);
          if (
            !prev ||
            prev.centerX !== centerX ||
            prev.centerY !== centerY ||
            prev.a !== autoA ||
            prev.b !== bVal ||
            prev.thetaEndLocal !== thetaEndLocal ||
            prev.rotAngle !== rotAngle ||
            prev.dir !== finalDir ||
            prev.ellipseTiltDeg !== ellipseTiltDeg ||
            prev.ellipseRotationDeg !== ellipseRotationDeg ||
            prev.direction !== direction ||
            prev.isCircle === true ||
            prev.rectWidth !== rect?.width ||
            prev.rectHeight !== rect?.height
          ) {
            const pathResult = computeSparkPathLength2D(
              autoA,
              bVal,
              rotAngle,
              thetaStartLocal,
              thetaEndLocal,
              centerX,
              centerY,
              ellipseTiltDeg,
              rect,
              p.startVertex,
              ellipseRotationDeg
            );
            pathMetricsRef.current.set(p.id, {
              pathLength: pathResult.pathLength,
              thetaEndLocal,
              actualThetaEnd: pathResult.actualThetaEnd,
              rotAngle,
              dir: finalDir,
              direction,
              centerX,
              centerY,
              a: autoA,
              b: bVal,
              ellipseTiltDeg,
              ellipseRotationDeg,
              isCircle: false,
              rectWidth: rect?.width,
              rectHeight: rect?.height,
            });
          }
        }
      }

      // Check if all paths are complete
      let allComplete = activePaths.length > 0;
      const animationTimeMsGlobal =
        cfg.animationTimeMs ?? DEFAULT_CONFIG.animationTimeMs;

      for (const p of activePaths) {
        const isCirclePathP =
          p.type === "circle" || p.circleRadius !== undefined;
        const isLinePathP = p.type === "line";

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

        const scaledPhase =
          (isCirclePathP
            ? applyEasingCircle(normalizedTime)
            : isLinePathP
            ? applyEasingLine(normalizedTime) // Apply easing for line
            : applyEasingSpark(normalizedTime)) * totalSpan;
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
        animationIdRef.current = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (onAnimationComplete) onAnimationComplete();
        return;
      }

      // Clear and draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const path of activePaths) {
        const isCirclePath =
          path.type === "circle" || path.circleRadius !== undefined;
        const isLinePath = path.type === "line";

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
          : isLinePath
          ? applyEasingLine(normalizedTime) // Apply easing for line
          : applyEasingSpark(normalizedTime);

        if (normalizedTime >= 1.0) {
          easedNormalizedTime = 1.0;
        }

        const metrics = pathMetricsRef.current.get(path.id);
        const pathLength = metrics?.pathLength || 1.0;

        const pathWithAutoEllipse = { ...path };
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
          pathWithAutoEllipse.ellipse = {
            ...(path.ellipse || {}),
            a: autoA,
            b: bVal,
          };
        } else if (!isLinePath) {
          // Only set up ellipse for spark paths, not line paths
          const ellipseCfg = path.ellipse || cfg.ellipse;
          let autoA = ellipseCfg?.a;
          let bVal = ellipseCfg?.b ?? 0.0;
          if (rect && autoA === undefined) {
            const diagonal = Math.hypot(rect.width, rect.height);
            autoA = 10 + diagonal / 2;
          } else if (autoA === undefined) {
            autoA = 150;
          }
          pathWithAutoEllipse.ellipse = {
            ...(path.ellipse || {}),
            a: autoA,
            b: bVal,
          };
        }

        drawPath2D({
          ctx,
          canvas,
          anchorCenter: [centerX, centerY],
          timeNowSec: currentTimeSec,
          globalConfig: cfg,
          pathConfig: pathWithAutoEllipse,
          easedNormalizedTime,
          totalArcPx: pathLength,
          metrics,
          isCirclePath,
          isLinePath, // Pass isLinePath flag
          anchorEl,
          elapsed, // Pass elapsed time for fadeIn/fadeOut calculation
          durationSec, // Pass duration for fadeOut calculation
        });
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
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      window.removeEventListener("resize", resizeCanvas);
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
