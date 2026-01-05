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
  
  // Store the base time when animation starts (shared across all anchorEls)
  const animationBaseTimeRef = useRef(null);
  
  // Normalize anchorEls: support both legacy (single anchorEl) and new (array) formats
  const normalizedAnchorEls = useRef([]);
  
  // Store refs for each anchorEl
  const anchorElRefsMap = useRef(new Map());
  
  // Metrics cache per anchorEl
  const metricsCacheMap = useRef(new Map());

  // Get SVG animation config to sync scaling
  const svgPathConfig = globalConfig.paths?.find(
    (p) => p.type === "svg" && p.enabled !== false
  );
  
  // Normalize anchorEls whenever anchorEl or anchorEls change
  useEffect(() => {
    // Convert legacy single anchorEl to array format
    const pathDelay = pathConfig?.delay || 0;
    if (anchorEl && !anchorEls) {
      normalizedAnchorEls.current = [{ element: anchorEl, delay: pathDelay }];
    } else if (anchorEls && Array.isArray(anchorEls)) {
      // New format: array of { element, delay? }
      // Combine betspot delay (from anchorEls) with path delay (from pathConfig)
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
  }, [anchorEl, anchorEls, pathConfig?.delay]);

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
    } else {
      // Clear start time for all anchorEls when stopped
      animationBaseTimeRef.current = null;
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
        // Get base dimensions (unscaled) from offsetWidth/offsetHeight
        const baseWidth = element.offsetWidth || 0;
        const baseHeight = element.offsetHeight || 0;
        
        // Get current scale from element's transform (set by SVG animation)
        let currentScale = 1.0;
        const transform = element.style.transform || window.getComputedStyle(element).transform || '';
        const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
        if (scaleMatch) {
          currentScale = parseFloat(scaleMatch[1]) || 1.0;
        }
        
        // Get position from getBoundingClientRect (includes scale)
        const rect = element.getBoundingClientRect();
        
        // Create scaled rect with correct dimensions
        const scaledRect = {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: baseWidth * currentScale,
          height: baseHeight * currentScale,
          x: rect.x,
          y: rect.y,
        };
        
        refs.anchorRectRef.current = scaledRect;
        refs.anchorCenterRef.current = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      };

      // Initial update
      updateAnchor();

      // Update rect continuously during animation to track scale changes
      // The SVG animation updates the scale via CSS transform, so we need to poll it
      let animationFrameId = null;
      const updateLoop = () => {
        updateAnchor();
        animationFrameId = requestAnimationFrame(updateLoop);
      };
      updateLoop();

      // Use ResizeObserver to track element size changes (scales with betspot)
      if (typeof ResizeObserver !== "undefined") {
        const resizeObserver = new ResizeObserver(() => {
          updateAnchor();
        });
        resizeObserver.observe(element);
        cleanupFunctions.push(() => {
          resizeObserver.disconnect();
        });
      }

      // Also listen to window resize/scroll for position changes
      window.addEventListener("resize", updateAnchor);
      window.addEventListener("scroll", updateAnchor, true);

      cleanupFunctions.push(() => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
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
        pathConfig.sparkColor || globalConfig.sparkColor || "#ffffff", // Default to white for inner color
      glowColor:
        pathConfig.glowColor || globalConfig.glowColor || null,
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

      // Create cache key based on rect dimensions (includes scale)
      // Use high precision to catch scale changes
      const cacheKey = `${rect.width.toFixed(2)}_${rect.height.toFixed(2)}_${centerX.toFixed(1)}_${centerY.toFixed(1)}`;

      // Return cached metrics if available and valid
      const cached = metricsCacheMap.current.get(cacheKey);
      if (cached && cached.cacheKey === cacheKey) {
        return cached.metrics;
      }

      // Use spin metrics calculation with scaled rect
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
      // Calculate headRadius to cover both border strokes
      // If headRadius is not explicitly set in config, calculate it to span from inner to outer border
      let effectiveHeadRadius = merged.headRadius;
      if (!pathConfig.headRadius && metrics?.borderWidth) {
        // headRadius should be borderWidth / 2 to cover from inner edge to outer edge
        // borderWidth is the total span from content edge to outer border edge
        effectiveHeadRadius = metrics.borderWidth / 2;
      }
      
      // Create a copy of merged with updated headRadius
      const mergedWithHeadRadius = {
        ...merged,
        headRadius: effectiveHeadRadius,
      };
      
      return generateSparkSpinPoints(
        metrics,
        normalizedTime,
        mergedWithHeadRadius,
        sparkColorRgb,
        anchorCenterRef,
        anchorRectRef
      );
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
