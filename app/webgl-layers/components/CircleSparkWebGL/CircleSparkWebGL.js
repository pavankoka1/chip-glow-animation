"use client";

import { useEffect, useRef } from "react";
import { hexToRgbNormalized } from "../utils/colorUtils";
import {
  calculateAutoA,
  findEllipseBetSpotIntersection,
  getAngleForVertexFromRect,
  getEllipsePosition2D,
  normalizeDelta,
} from "../utils/geometryUtils";
import { useSharedWebGL } from "../SharedWebGLContext";

export default function CircleSparkWebGL({
  anchorEl, // Legacy: single element (for backward compatibility)
  anchorEls, // New: array of { element, delay? }
  pathConfig,
  isPlaying = false,
  globalConfig = {},
}) {
  const { registerAnimation, unregisterAnimation } = useSharedWebGL();
  
  const isPlayingRef = useRef(isPlaying);
  const spark1StartLoggedRef = useRef(false);
  const spark1EndLoggedRef = useRef(false);
  
  // Store the base time when animation starts (shared across all anchorEls)
  const animationBaseTimeRef = useRef(null);
  
  // Normalize anchorEls: support both legacy (single anchorEl) and new (array) formats
  const normalizedAnchorEls = useRef([]);
  
  // Store refs for each anchorEl
  const anchorElRefsMap = useRef(new Map());
  
  // Metrics cache per anchorEl
  const metricsCacheMap = useRef(new Map());
  
  // Normalize anchorEls whenever anchorEl or anchorEls change
  useEffect(() => {
    // Convert legacy single anchorEl to array format
    if (anchorEl && !anchorEls) {
      // Use path delay from config
      const pathDelay = pathConfig?.delay || 0;
      normalizedAnchorEls.current = [{ element: anchorEl, delay: pathDelay }];
    } else if (anchorEls && Array.isArray(anchorEls)) {
      // New format: array of { element, delay? }
      // Combine betspot delay (from anchorEls) with path delay (from pathConfig)
      const pathDelay = pathConfig?.delay || 0;
      normalizedAnchorEls.current = anchorEls.map(ae => {
        // Get betspot delay (delay between betspots)
        const betspotDelay = typeof ae === 'object' && 'delay' in ae ? (ae.delay || 0) : 0;
        // Total delay = path delay + betspot delay
        const totalDelay = pathDelay + betspotDelay;
        
        // If ae is already { element, delay }, use the element and combine delays
        if (typeof ae === 'object' && 'element' in ae) {
          return { element: ae.element, delay: totalDelay };
        }
        // Otherwise, extract element
        return {
          element: typeof ae === 'object' && ae.element ? ae.element : ae,
          delay: totalDelay,
        };
      });
    } else {
      normalizedAnchorEls.current = [];
    }
  }, [anchorEl, anchorEls, pathConfig?.delay, pathConfig?.id]);

  // Update refs when props change
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      // Set base time for animation start (shared across all anchorEls)
      animationBaseTimeRef.current = performance.now();
      
      // Reset start time for all anchorEls when playing starts
      // Use a small delay to ensure refs are initialized
      requestAnimationFrame(() => {
        const baseTime = animationBaseTimeRef.current || performance.now();
        normalizedAnchorEls.current.forEach((ae, index) => {
          const key = `${ae.element?.id || index}`;
          let refs = anchorElRefsMap.current.get(key);
          
          if (refs) {
            // Set start time - delays will be handled in SharedWebGLContext
            refs.startTimeRef.current = baseTime;
          } else {
            // If refs don't exist yet, initialize them
            const newRefs = {
              anchorRectRef: { current: null },
              anchorCenterRef: { current: { x: 0, y: 0 } },
              startTimeRef: { current: baseTime },
            };
            anchorElRefsMap.current.set(key, newRefs);
          }
        });
      });
      // Reset spark 1 tracking when animation starts
      if (pathConfig.id === 1) {
        spark1StartLoggedRef.current = false;
        spark1EndLoggedRef.current = false;
      }
    } else {
      // Clear start time for all anchorEls when stopped
      animationBaseTimeRef.current = null;
      anchorElRefsMap.current.forEach((refs) => {
        refs.startTimeRef.current = null;
      });
      // Reset spark 1 tracking when animation stops
      if (pathConfig.id === 1) {
        spark1StartLoggedRef.current = false;
        spark1EndLoggedRef.current = false;
      }
    }
  }, [isPlaying, pathConfig.id]);

  // Update anchor element positions for all anchorEls
  useEffect(() => {
    const cleanupFunctions = [];

    normalizedAnchorEls.current.forEach((ae, index) => {
      const element = ae.element;
      if (!element) return;

      const key = `${element.id || index}`;
      
      // Initialize refs for this anchorEl if not exists
      if (!anchorElRefsMap.current.has(key)) {
        anchorElRefsMap.current.set(key, {
          anchorRectRef: { current: null },
          anchorCenterRef: { current: { x: 0, y: 0 } },
          startTimeRef: { current: null },
        });
      }

      const refs = anchorElRefsMap.current.get(key);

      const updateAnchor = () => {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        refs.anchorRectRef.current = rect;
        refs.anchorCenterRef.current = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      };

      updateAnchor();
      window.addEventListener("resize", updateAnchor);
      window.addEventListener("scroll", updateAnchor, true);

      cleanupFunctions.push(() => {
        window.removeEventListener("resize", updateAnchor);
        window.removeEventListener("scroll", updateAnchor, true);
      });
    });

    // Cleanup old refs for removed anchorEls
    const currentKeys = new Set(normalizedAnchorEls.current.map((ae, index) => `${ae.element?.id || index}`));
    anchorElRefsMap.current.forEach((refs, key) => {
      if (!currentKeys.has(key)) {
        anchorElRefsMap.current.delete(key);
      }
    });

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [anchorEl, anchorEls]);

  // Register with shared WebGL context
  useEffect(() => {
    if (normalizedAnchorEls.current.length === 0 || !pathConfig.id) return;

    // Merge config values
    const merged = {
      sparkColor:
        pathConfig.sparkColor || globalConfig.sparkColor || "#f1eb9d",
      headRadius: pathConfig.headRadius || globalConfig.headRadius || 2,
      tailRadius: pathConfig.tailRadius || globalConfig.tailRadius || 0.4,
      length: pathConfig.length !== undefined ? pathConfig.length : (globalConfig.length !== undefined ? globalConfig.length : 5),
      dotCount: pathConfig.dotCount || 100,
      delay: pathConfig.delay || 0,
      animationTimeMs: pathConfig.animationTimeMs || 1000,
      whiteCenterRatio:
        pathConfig.whiteCenterRatio !== undefined
          ? pathConfig.whiteCenterRatio
          : globalConfig.whiteCenterRatio !== undefined
          ? globalConfig.whiteCenterRatio
          : 0.5,
      glowRadius: pathConfig.glowRadius || 0.5,
      glowOpacity: pathConfig.glowOpacity || 0.15,
      headTaperRatio: pathConfig.headTaperRatio || 0.08,
      headCurve: pathConfig.headCurve || 0.2,
      whiteCoverage: pathConfig.whiteCoverage || 0.92,
      ellipseTiltDeg: pathConfig.ellipseTiltDeg || 0,
      ellipseRotationDeg: pathConfig.ellipseRotationDeg || 0,
      startVertex: pathConfig.startVertex || "BR",
      endVertex: pathConfig.endVertex || "TL",
      ellipse: pathConfig.ellipse ||
        globalConfig.ellipse || { a: 37, b: 8.5 },
    };

    const sparkColorRgb = hexToRgbNormalized(merged.sparkColor);

    // Calculate ellipse metrics for a specific anchorEl
    const calculateMetrics = (anchorRectRef, anchorCenterRef) => {
      if (!anchorRectRef?.current) {
        return null;
      }

      const rect = anchorRectRef.current;
      const centerX = anchorCenterRef.current.x;
      const centerY = anchorCenterRef.current.y;

      // Create cache key based on rect and config
      const newCacheKey = `${rect.width}_${rect.height}_${merged.startVertex}_${merged.endVertex}`;
      const cache = metricsCacheMap.current.get(newCacheKey);
      if (cache && cache.cacheKey === newCacheKey) {
        return cache.metrics;
      }

      const startDir = getAngleForVertexFromRect(merged.startVertex, rect);
      const endDir = getAngleForVertexFromRect(merged.endVertex, rect);

      const delta = normalizeDelta(endDir - startDir);
      const dir = Math.sign(delta) || 1;

      const thetaStartLocal = 0.0;
      const thetaEndLocal = dir * Math.abs(delta || Math.PI);
      const rotAngle = startDir;

      // Use 'a' from config if provided, otherwise calculate dynamically from betspot diagonal
      let a;
      if (merged.ellipse?.a !== undefined && merged.ellipse?.a !== null) {
        // Use config value if explicitly provided
        a = merged.ellipse.a;
      } else {
        // Calculate dynamically (default behavior)
        const minDimension = Math.min(rect.width, rect.height);
        const offset = minDimension < 50 ? 6 : 10;
        a = calculateAutoA(rect, offset);
      }
      
      // Use 'b' from config if provided, otherwise use default
      const b = merged.ellipse?.b !== undefined && merged.ellipse?.b !== null 
        ? merged.ellipse.b 
        : 8.5;

      // Find where ellipse re-enters betspot (for return journey)
      const actualThetaEnd = findEllipseBetSpotIntersection(
        a,
        b,
        rotAngle,
        centerX,
        centerY,
        merged.ellipseTiltDeg,
        thetaStartLocal,
        thetaEndLocal,
        rect,
        merged.ellipseRotationDeg
      );

      const metrics = {
        thetaStart: thetaStartLocal,
        thetaEnd: thetaEndLocal,
        actualThetaEnd,
        rotAngle,
        a,
        b,
        rect,
      };

      metricsCacheMap.current.set(newCacheKey, { metrics, cacheKey: newCacheKey });
      return metrics;
    };

    const generatePoints = (metrics, normalizedTime, anchorCenterRef, anchorRectRef) => {
      if (!metrics) {
        return [];
      }

      const points = [];
      const centerX = anchorCenterRef.current.x;
      const centerY = anchorCenterRef.current.y;
      const rect = metrics.rect;

      // Calculate position along ellipse path (from start to actual end including return)
      const thetaStart = metrics.thetaStart;
      const actualThetaEnd = metrics.actualThetaEnd;
      const initialThetaEnd = metrics.thetaEnd;

      // Calculate the ratio of initial path to total path
      const totalPathRange = Math.abs(actualThetaEnd - thetaStart);
      const initialPathRange = Math.abs(initialThetaEnd - thetaStart);
      const initialPathRatio =
        initialPathRange / Math.max(totalPathRange, 0.0001);

      // Use length from config (in pixels) - matching original webgl implementation
      const lengthPx = merged.length || 5;

      // Calculate approximate average "radius" for arc length conversion
      const avgRadius = (metrics.a + metrics.b) / 2;
      const safeAvgRadius = Math.max(avgRadius, 1);

      // Convert spark length to path parameter offset (0 to span)
      const lengthInPath = lengthPx / safeAvgRadius;
      const span = totalPathRange;
      
      // animationTimeMs is the time from head start to tail reaching endpoint
      const totalPathWithSpark = span + lengthInPath;
      const phase = normalizedTime * totalPathWithSpark;
      
      // Head position: starts at 0, moves forward to span + lengthInPath
      const segHead = Math.max(0, Math.min(span + lengthInPath, phase));
      
      // Tail position: extends backward from head by spark length
      const segTail = Math.max(0, Math.min(span, segHead - lengthInPath));

      const sampleCount = merged.dotCount;
      const headTaperRatio = merged.headTaperRatio;
      const tipRadius = merged.tailRadius * 0.25;

      const scaledHeadRadius = merged.headRadius;
      const scaledTailRadius = merged.tailRadius;
      const scaledTipRadius = tipRadius;
      const scaledGlowRadius = merged.glowRadius;

      const halfWidth = rect ? rect.width / 2 : 50;
      const halfHeight = rect ? rect.height / 2 : 50;

      // Generate dots along spark (from tail to head)
      for (let i = 0; i <= sampleCount; i++) {
        const along01 = sampleCount > 0 ? i / sampleCount : 0;

        // Calculate path parameter t for this point along the spark
        const t = segTail + (segHead - segTail) * along01;

        // Clamp t to valid range (0 to span)
        const tClamped = Math.max(0, Math.min(span, t));

        // Convert path parameter to theta
        const pointTheta =
          thetaStart + (actualThetaEnd - thetaStart) * (tClamped / span);

        // Get position on ellipse for this point
        const [x, y] = getEllipsePosition2D(
          pointTheta,
          metrics.a,
          metrics.b,
          metrics.rotAngle,
          centerX,
          centerY,
          merged.ellipseTiltDeg,
          merged.ellipseRotationDeg
        );

        // Check if we're past the initial path (return journey)
        const isPastInitialPath = tClamped > initialPathRatio * span;

        // If we're past the initial path and inside betspot, skip this point
        if (isPastInitialPath) {
          const isInside =
            x >= centerX - halfWidth &&
            x <= centerX + halfWidth &&
            y >= centerY - halfHeight &&
            y <= centerY + halfHeight;
          if (isInside) {
            continue;
          }
        }

        // Head tapering logic
        let radius;
        if (headTaperRatio > 0 && along01 > 1 - headTaperRatio) {
          const tipT = (along01 - (1 - headTaperRatio)) / headTaperRatio;
          let smoothness = Math.cos((tipT * Math.PI) / 2);

          if (merged.headCurve > 0) {
            const curvePower = 1.0 + merged.headCurve * 2.0;
            smoothness = Math.pow(smoothness, 1.0 / curvePower);
          }

          radius =
            scaledTipRadius +
            (scaledHeadRadius - scaledTipRadius) * smoothness;
        } else if (headTaperRatio > 0) {
          const bodyT = along01 / (1 - headTaperRatio);
          radius =
            scaledTailRadius + (scaledHeadRadius - scaledTailRadius) * bodyT;
        } else {
          radius =
            scaledTailRadius +
            (scaledHeadRadius - scaledTailRadius) * along01;
        }

        points.push({
          x,
          y,
          radius: Math.max(1, radius),
          color: sparkColorRgb,
          alpha: 1,
          along01: along01,
          glowRadius: scaledGlowRadius,
        });
      }

      return points;
    };

    // Build anchorEls array with refs for registration
    const anchorElsForRegistration = normalizedAnchorEls.current.map((ae, index) => {
      const key = `${ae.element?.id || index}`;
      let refs = anchorElRefsMap.current.get(key);
      if (!refs) {
        // Initialize refs if they don't exist yet
        refs = {
          anchorRectRef: { current: null },
          anchorCenterRef: { current: { x: 0, y: 0 } },
          startTimeRef: { current: null },
        };
        anchorElRefsMap.current.set(key, refs);
      }
      
      // Set startTime if playing (this ensures it's set during registration)
      // Use a consistent base time for all anchorEls so delays work correctly
      if (isPlayingRef.current && !refs.startTimeRef.current) {
        // Use the same base time that was set in the useEffect
        // This ensures all anchorEls have the same start time, and delays are applied correctly
        const baseTime = animationBaseTimeRef.current || performance.now();
        refs.startTimeRef.current = baseTime;
      }
      
      // Extract delay - ensure it's a number
      const delayValue = typeof ae === 'object' && 'delay' in ae 
        ? (typeof ae.delay === 'number' ? ae.delay : 0)
        : 0;
      
      return {
        element: ae.element,
        delay: delayValue, // Get delay from anchorEl data
        anchorRectRef: refs.anchorRectRef,
        anchorCenterRef: refs.anchorCenterRef,
        startTimeRef: refs.startTimeRef,
      };
    }).filter(ae => ae.element); // Filter out any without elements

    // Register this animation with the shared context
    const animationId = `circle-spark-${pathConfig.id}`;
    registerAnimation(animationId, {
      generatePoints,
      calculateMetrics,
      isPlayingRef,
      anchorEls: anchorElsForRegistration,
      pathConfig: merged,
      globalConfig,
    });

    return () => {
      unregisterAnimation(animationId);
    };
  }, [anchorEl, anchorEls, pathConfig, globalConfig, isPlaying, registerAnimation, unregisterAnimation]);

  return null; // No canvas rendering - handled by shared context
}
