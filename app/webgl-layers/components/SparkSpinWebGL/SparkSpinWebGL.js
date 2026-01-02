"use client";

import { useEffect, useRef } from "react";
import { computeSpinMetrics } from "../../../components/canvas2d/animations/spin";
import { hexToRgbNormalized } from "../utils/colorUtils";
import { useSharedWebGL } from "../SharedWebGLContext";
import { generateSparkSpinPoints } from "./sparkSpinPointGenerator";

export default function SparkSpinWebGL({
  anchorEl, // Legacy: single element (for backward compatibility)
  anchorEls, // New: array of { element, delay? }
  pathConfig,
  isPlaying = false,
  globalConfig = {},
}) {
  const { registerAnimation, unregisterAnimation } = useSharedWebGL();
  
  const isPlayingRef = useRef(isPlaying);
  
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
      normalizedAnchorEls.current = [{ element: anchorEl, delay: pathConfig?.delay || 0 }];
    } else if (anchorEls && Array.isArray(anchorEls)) {
      // New format: array of { element, delay? }
      normalizedAnchorEls.current = anchorEls.map(ae => ({
        element: typeof ae === 'object' && ae.element ? ae.element : ae,
        delay: (typeof ae === 'object' && ae.delay !== undefined) ? ae.delay : (pathConfig?.delay || 0),
      }));
    } else {
      normalizedAnchorEls.current = [];
    }
  }, [anchorEl, anchorEls, pathConfig?.delay]);

  // Update refs when props change
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      // Reset start time for all anchorEls when playing starts
      normalizedAnchorEls.current.forEach((ae, index) => {
        const key = `${ae.element?.id || index}`;
        let refs = anchorElRefsMap.current.get(key);
        if (refs) {
          refs.startTimeRef.current = performance.now();
        }
      });
    } else {
      // Clear start time for all anchorEls when stopped
      anchorElRefsMap.current.forEach((refs) => {
        refs.startTimeRef.current = null;
      });
    }
  }, [isPlaying]);

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
        pathConfig.sparkColor || globalConfig.sparkColor || "#D70C0C",
      headRadius: pathConfig.headRadius || globalConfig.headRadius || 2,
      tailRadius: pathConfig.tailRadius || globalConfig.tailRadius || 0.4,
      length:
        pathConfig.length !== undefined
          ? pathConfig.length
          : globalConfig.length !== undefined
          ? globalConfig.length
          : 5,
      dotCount: pathConfig.dotCount || 100,
      delay: pathConfig.delay || 0,
      animationTimeMs: pathConfig.animationTimeMs || 14500,
      whiteCenterRatio:
        pathConfig.whiteCenterRatio !== undefined
          ? pathConfig.whiteCenterRatio
          : globalConfig.whiteCenterRatio !== undefined
          ? globalConfig.whiteCenterRatio
          : 0.2,
      glowRadius: pathConfig.glowRadius || 0.5,
      glowOpacity: pathConfig.glowOpacity || 0.15,
      headTaperRatio: pathConfig.headTaperRatio || 0.08,
      headCurve: pathConfig.headCurve || 0.2,
      whiteCoverage: pathConfig.whiteCoverage || 0.92,
      borderRadius: pathConfig.borderRadius || 6.75,
    };

    const sparkColorRgb = hexToRgbNormalized(merged.sparkColor);

    // Calculate metrics for a specific anchorEl
    const calculateMetrics = (anchorRectRef, anchorCenterRef) => {
      if (!anchorRectRef?.current) {
        return null;
      }

      const rect = anchorRectRef.current;
      const centerX = anchorCenterRef.current.x;
      const centerY = anchorCenterRef.current.y;

      // Create cache key based on rect dimensions
      const cacheKey = `${rect.width}_${rect.height}_${centerX}_${centerY}`;

      // Return cached metrics if available and valid
      const cached = metricsCacheMap.current.get(cacheKey);
      if (cached && cached.cacheKey === cacheKey) {
        return cached.metrics;
      }

      // Use spin metrics calculation
      const metrics = computeSpinMetrics(
        pathConfig,
        globalConfig,
        rect,
        centerX,
        centerY
      );

      // Cache the metrics
      metricsCacheMap.current.set(cacheKey, { metrics, cacheKey });

      return metrics;
    };

    const generatePoints = (metrics, normalizedTime, anchorCenterRef, anchorRectRef) => {
      return generateSparkSpinPoints(
        metrics,
        normalizedTime,
        merged,
        sparkColorRgb,
        anchorCenterRef,
        anchorRectRef
      );
    };

    // Build anchorEls array with refs for registration
    const anchorElsForRegistration = normalizedAnchorEls.current.map((ae, index) => {
      const key = `${ae.element?.id || index}`;
      const refs = anchorElRefsMap.current.get(key);
      if (!refs) {
        // Initialize refs if they don't exist yet
        const newRefs = {
          anchorRectRef: { current: null },
          anchorCenterRef: { current: { x: 0, y: 0 } },
          startTimeRef: { current: null },
        };
        anchorElRefsMap.current.set(key, newRefs);
        return {
          element: ae.element,
          delay: ae.delay,
          anchorRectRef: newRefs.anchorRectRef,
          anchorCenterRef: newRefs.anchorCenterRef,
          startTimeRef: newRefs.startTimeRef,
        };
      }
      return {
        element: ae.element,
        delay: ae.delay,
        anchorRectRef: refs.anchorRectRef,
        anchorCenterRef: refs.anchorCenterRef,
        startTimeRef: refs.startTimeRef,
      };
    }).filter(ae => ae.element); // Filter out any without elements

    // Register this animation with the shared context
    const animationId = `spark-spin-${pathConfig.id}`;
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
