import { useCallback, useEffect } from "react";
import { updateMultiplierAnimations } from "../utils/multiplierAnimation";

export function useAnimationHandlers(
  betspotCount,
  config,
  isPlaying,
  selectedBetspots,
  glowEffects,
  multiplierRefs,
  currentTimeSecRefs,
  setIsPlaying,
  isPlayingRef,
  selectedBetspotsRef
) {
  const {
    betspotRefsStorage,
    svgRefsStorage,
    svgMaxScaleReachedRef,
    svgPreviousScaleRef,
    svgGlowPeakReachedRef,
    betspotOriginalSizeRef,
    setGlowIntensities,
  } = glowEffects;

  const handleAnimationComplete = useCallback(
    (betspotIndex) => {
      svgMaxScaleReachedRef.current[betspotIndex] = false;
      svgPreviousScaleRef.current[betspotIndex] = 1.0;
      svgGlowPeakReachedRef.current[betspotIndex] = false;
      delete betspotOriginalSizeRef.current[betspotIndex];

      const element = betspotRefsStorage.current[betspotIndex];
      if (element) {
        element.style.borderRadius = "";
        element.style.boxShadow = "";
        element.style.overflow = "";
        element.style.transform = "scale(1)";
      }

      const svgElement = svgRefsStorage.current[betspotIndex];
      if (svgElement) {
        svgElement.style.opacity = "0";
        svgElement.style.transform = "scale(1)";
        svgElement.style.visibility = "hidden";
      }

      setGlowIntensities((prev) => {
        const newIntensities = [...prev];
        if (newIntensities[betspotIndex]) {
          newIntensities[betspotIndex] = {
            chipGlowIntensity: 0,
            perimeterGlowIntensity: 0,
            glowScale: 1.0,
          };
        }
        return newIntensities;
      });

      setIsPlaying((prev) => {
        if (prev[betspotIndex] === true) {
          const newPlaying = [...prev];
          newPlaying[betspotIndex] = false;
          isPlayingRef.current = newPlaying;
          return newPlaying;
        }
        return prev;
      });
    },
    [setGlowIntensities, setIsPlaying, isPlayingRef]
  );

  const handleTimeUpdate = useCallback(
    (index, currentTimeSec) => {
      currentTimeSecRefs.current[index] = currentTimeSec;
      updateMultiplierAnimations(index, currentTimeSec, multiplierRefs, config);
    },
    [config, multiplierRefs]
  );

  useEffect(() => {
    isPlaying.forEach((playing, index) => {
      const shouldAnimate =
        (playing || currentTimeSecRefs.current[index] > 0) &&
        selectedBetspots[index];
      if (!shouldAnimate) {
        const multiplierElements = multiplierRefs.current[index];
        if (multiplierElements) {
          multiplierElements.forEach((multiplierEl) => {
            if (multiplierEl) {
              multiplierEl.style.transform = "translate(-50%, -50%) scale(0)";
              multiplierEl.style.opacity = "0";
            }
          });
        }
        currentTimeSecRefs.current[index] = 0;

        const svgElement = svgRefsStorage.current[index];
        if (svgElement) {
          svgElement.style.opacity = "0";
          svgElement.style.transform = "scale(1)";
          svgElement.style.visibility = "hidden";
        }

        const element = betspotRefsStorage.current[index];
        if (element) {
          element.style.transform = "scale(1)";
          element.style.borderRadius = "";
          element.style.boxShadow = "";
          element.style.overflow = "";
        }
      }
    });
  }, [
    isPlaying,
    selectedBetspots,
    multiplierRefs,
    svgRefsStorage,
    betspotRefsStorage,
    currentTimeSecRefs,
  ]);

  return {
    handleAnimationComplete,
    handleTimeUpdate,
  };
}
