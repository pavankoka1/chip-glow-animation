"use client";

import { useEffect, useRef } from "react";
import useFps from "../hooks/useFps";
import { DEFAULT_CONFIG } from "./animation/constants";
import * as circleAnimation from "./canvas2d/animations/circle";
import * as lineAnimation from "./canvas2d/animations/line";
import * as sparkAnimation from "./canvas2d/animations/spark";
import { EPSILON, MAX_DT_SEC } from "./canvas2d/constants";
import { CPUMonitor, drawCPUUsage } from "./canvas2d/cpuMonitor";
import {
  applyEasingCircle,
  applyEasingLine,
  applyEasingSpark,
} from "./canvas2d/easing";
import { calculateAutoA, getDynamicRotAngle } from "./canvas2d/geometry";
import { renderPath } from "./canvas2d/pathRenderer";
import { delayToSeconds } from "./canvas2d/utils";

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
  const cpuMonitorRef = useRef(new CPUMonitor(60));
  useFps({ sampleSize: 90 });

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
      cpuMonitorRef.current.startFrame();
      if (!isPlaying) {
        animationIdRef.current = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dtSec = Math.min(MAX_DT_SEC, (ts - lastTsRef.current) / 1000);
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
        const segmentParam = lineLength / Math.max(pathLength, EPSILON);
        const overshoot = p.overshoot ?? cfg.overshoot ?? 0.08;
        const fadeWindow = p.fadeWindow ?? cfg.fadeWindow ?? 0.08;
        const totalSpan = 1.0 + segmentParam + overshoot;

        const normalizedTime = Math.min(
          1.0,
          Math.max(0.0, elapsed / Math.max(durationSec, EPSILON))
        );

        const scaledPhase =
          (isCirclePathP
            ? applyEasingCircle(normalizedTime)
            : isLinePathP
            ? applyEasingLine(normalizedTime)
            : applyEasingSpark(normalizedTime)) * totalSpan;
        const completeThreshold = totalSpan + fadeWindow;

        const fadeWindowDuration = (fadeWindow / totalSpan) * durationSec;
        const totalDuration = durationSec + fadeWindowDuration;

        const isPathComplete =
          elapsed >= totalDuration ||
          scaledPhase >= completeThreshold - EPSILON;

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
          Math.max(0.0, elapsed / Math.max(durationSec, EPSILON))
        );

        let easedNormalizedTime = isCirclePath
          ? applyEasingCircle(normalizedTime)
          : isLinePath
          ? applyEasingLine(normalizedTime)
          : applyEasingSpark(normalizedTime);

        if (normalizedTime >= 1.0) {
          easedNormalizedTime = 1.0;
        }

        const metrics = pathMetricsRef.current.get(path.id);
        const pathLength = metrics?.pathLength || 1.0;

        const pathWithAutoEllipse = { ...path };
        if (isCirclePath) {
          const circleRadius = path.circleRadius ?? 30;
          const autoA = calculateAutoA(rect);
          const bVal = circleRadius;
          pathWithAutoEllipse.ellipse = {
            ...(path.ellipse || {}),
            a: autoA,
            b: bVal,
          };
        } else if (!isLinePath) {
          const ellipseCfg = path.ellipse || cfg.ellipse;
          let autoA = ellipseCfg?.a;
          let bVal = ellipseCfg?.b ?? 0.0;
          if (rect && autoA === undefined) {
            autoA = calculateAutoA(rect, 10);
          } else if (autoA === undefined) {
            autoA = 150;
          }
          pathWithAutoEllipse.ellipse = {
            ...(path.ellipse || {}),
            a: autoA,
            b: bVal,
          };
        }

        renderPath({
          ctx,
          anchorCenter: [centerX, centerY],
          timeNowSec: currentTimeSec,
          globalConfig: cfg,
          pathConfig: pathWithAutoEllipse,
          easedNormalizedTime,
          totalArcPx: pathLength,
          metrics,
          isCirclePath,
          isLinePath,
          anchorEl,
          elapsed,
          durationSec,
          rect,
        });
      }

      const frameTime = cpuMonitorRef.current.endFrame();
      const cpuUsage = cpuMonitorRef.current.getCPUUsage();

      drawCPUUsage(ctx, cpuUsage, frameTime, canvas.width, 0);

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
