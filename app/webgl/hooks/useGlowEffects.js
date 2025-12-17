import { useCallback, useEffect, useRef, useState } from "react";
import { applyGlowToElement } from "../utils/glowEffects";

export function useGlowEffects(betspotCount, config, setAnchorEls) {
  const betspotRefsStorage = useRef({});
  const svgRefsStorage = useRef({});
  const svgMaxScaleReachedRef = useRef({});
  const svgPreviousScaleRef = useRef({});
  const svgGlowPeakReachedRef = useRef({});
  const betspotOriginalSizeRef = useRef({});

  const glowIntensityUpdateQueueRef = useRef(new Map());
  const glowIntensityUpdateTimeoutRef = useRef(null);

  const [glowIntensities, setGlowIntensities] = useState(() =>
    Array.from({ length: betspotCount }, () => ({
      chipGlowIntensity: 0,
      perimeterGlowIntensity: 0,
      glowScale: 1,
    }))
  );

  const createAnchorRefCallback = useCallback(
    (index) => {
      return (el) => {
        betspotRefsStorage.current[index] = el;
        setAnchorEls((prev) => {
          if (prev[index] === el) return prev;
          const newEls = [...prev];
          newEls[index] = el;
          return newEls;
        });
      };
    },
    [setAnchorEls]
  );

  const anchorRefCallbacksRef = useRef({});
  const getAnchorRefCallback = useCallback(
    (index) => {
      if (!anchorRefCallbacksRef.current[index]) {
        anchorRefCallbacksRef.current[index] = createAnchorRefCallback(index);
      }
      return anchorRefCallbacksRef.current[index];
    },
    [createAnchorRefCallback]
  );

  const createSvgRefCallback = useCallback((index) => {
    return (el) => {
      svgRefsStorage.current[index] = el;
    };
  }, []);

  const svgRefCallbacksRef = useRef({});
  const getSvgRefCallback = useCallback(
    (index) => {
      if (!svgRefCallbacksRef.current[index]) {
        svgRefCallbacksRef.current[index] = createSvgRefCallback(index);
      }
      return svgRefCallbacksRef.current[index];
    },
    [createSvgRefCallback]
  );

  const flushGlowIntensityUpdates = useCallback(() => {
    if (glowIntensityUpdateQueueRef.current.size === 0) return;

    setGlowIntensities((prev) => {
      const newIntensities = [...prev];
      let hasChanges = false;

      glowIntensityUpdateQueueRef.current.forEach((intensities, index) => {
        const current = prev[index];
        const chipChanged =
          Math.abs(
            (current?.chipGlowIntensity || 0) - intensities.chipGlowIntensity
          ) > 0.001;
        const perimeterChanged =
          Math.abs(
            (current?.perimeterGlowIntensity || 0) -
              intensities.perimeterGlowIntensity
          ) > 0.001;
        const scaleChanged =
          Math.abs(
            (current?.glowScale || 1.0) - (intensities.glowScale || 1.0)
          ) > 0.001;

        if (chipChanged || perimeterChanged || scaleChanged) {
          newIntensities[index] = intensities;
          hasChanges = true;
        }
      });

      glowIntensityUpdateQueueRef.current.clear();
      return hasChanges ? newIntensities : prev;
    });

    glowIntensityUpdateTimeoutRef.current = null;
  }, []);

  const glowIntensityHandlersRef = useRef({});

  const getGlowIntensityHandler = useCallback(
    (index) => {
      if (!glowIntensityHandlersRef.current[index]) {
        glowIntensityHandlersRef.current[index] = (intensities) => {
          const element = betspotRefsStorage.current[index];
          const svgElement = svgRefsStorage.current[index];
          const svgPath = config.paths?.find(
            (p) => p.type === "svg" && p.enabled !== false
          );

          if (element) {
            applyGlowToElement(
              element,
              intensities,
              index,
              svgElement,
              svgPath,
              {
                svgMaxScaleReachedRef,
                svgPreviousScaleRef,
                svgGlowPeakReachedRef,
                betspotOriginalSizeRef,
              }
            );
          }

          glowIntensityUpdateQueueRef.current.set(index, intensities);
          if (!glowIntensityUpdateTimeoutRef.current) {
            glowIntensityUpdateTimeoutRef.current = requestAnimationFrame(
              () => {
                flushGlowIntensityUpdates();
              }
            );
          }
        };
      }
      return glowIntensityHandlersRef.current[index];
    },
    [flushGlowIntensityUpdates, config]
  );

  useEffect(() => {
    return () => {
      if (glowIntensityUpdateTimeoutRef.current) {
        cancelAnimationFrame(glowIntensityUpdateTimeoutRef.current);
      }
    };
  }, []);

  return {
    betspotRefsStorage,
    svgRefsStorage,
    svgMaxScaleReachedRef,
    svgPreviousScaleRef,
    svgGlowPeakReachedRef,
    betspotOriginalSizeRef,
    glowIntensities,
    setGlowIntensities,
    getAnchorRefCallback,
    getSvgRefCallback,
    getGlowIntensityHandler,
  };
}
