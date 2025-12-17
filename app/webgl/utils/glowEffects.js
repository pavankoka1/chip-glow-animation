export function applyGlowToElement(
  element,
  intensities,
  index,
  svgElement,
  svgPath,
  refs
) {
  if (!element) return;

  const {
    svgMaxScaleReachedRef,
    svgPreviousScaleRef,
    svgGlowPeakReachedRef,
    betspotOriginalSizeRef,
  } = refs;

  const glowScale = intensities?.glowScale || 1;

  element.style.transform = `scale(${glowScale}) translateZ(0)`;
  element.style.transformOrigin = "center center";

  const hasSvgPath = !!svgPath;

  if (svgElement && hasSvgPath) {
    const threshold = 1.09;
    const previousScale = svgPreviousScaleRef.current[index] || 1.0;
    const wasMaxReached = svgMaxScaleReachedRef.current[index] || false;

    if (glowScale >= threshold) {
      svgMaxScaleReachedRef.current[index] = true;
    }

    if (!wasMaxReached && previousScale > 1.05 && glowScale < previousScale) {
      svgMaxScaleReachedRef.current[index] = true;
    }

    svgPreviousScaleRef.current[index] = glowScale;

    let opacity = 0;
    const isMaxReached = svgMaxScaleReachedRef.current[index];

    if (isMaxReached) {
      opacity = 1;
    } else if (glowScale === 1.0) {
      opacity = 0;
    } else {
      opacity = Math.min(1, Math.max(0, (glowScale - 1) / 0.1));
    }

    svgElement.style.opacity = opacity;
    svgElement.style.transform = `scale(${glowScale}) translateZ(0)`;
    svgElement.style.transformOrigin = "center center";

    if (opacity > 0) {
      svgElement.style.visibility = "visible";
    } else {
      svgElement.style.visibility = "hidden";
    }

    let glowIntensity = 0;

    if (!svgGlowPeakReachedRef.current[index]) {
      svgGlowPeakReachedRef.current[index] = false;
    }

    const isGoingDown = previousScale > glowScale;
    if ((isGoingDown && previousScale >= 1.05) || glowScale >= 1.1) {
      svgGlowPeakReachedRef.current[index] = true;
    }

    const hasReachedPeak = svgGlowPeakReachedRef.current[index];

    if (!hasReachedPeak) {
      if (glowScale > 1.0) {
        glowIntensity = Math.min(1, Math.max(0, (glowScale - 1.0) / 0.1));
      } else {
        glowIntensity = 0;
      }
    } else {
      if (glowScale >= 1.1) {
        glowIntensity = 1.0;
      } else if (glowScale > 1.0) {
        glowIntensity = Math.min(1, Math.max(0, (glowScale - 1.0) / 0.1));
      } else {
        glowIntensity = 0;
      }
    }

    if (glowIntensity > 0) {
      if (!betspotOriginalSizeRef.current[index]) {
        const rect = element.getBoundingClientRect();
        if (glowScale === 1.0) {
          betspotOriginalSizeRef.current[index] = Math.max(
            rect.width,
            rect.height
          );
        } else {
          betspotOriginalSizeRef.current[index] =
            Math.max(rect.width, rect.height) / glowScale;
        }
      }

      const baseSize = betspotOriginalSizeRef.current[index];
      const glowSpread = svgPath?.glowSpread ?? 0.02;

      const baseBlur1 = baseSize * 0.15;
      const baseBlur2 = baseSize * 0.08;
      const spread1 = baseSize * glowSpread;
      const spread2 = baseSize * (glowSpread * 0.5);

      const glowColor = "rgba(255, 187, 1, 1)";
      const glowColor2 = "rgba(255, 187, 1, 0.8)";

      const blur1 = baseBlur1 * glowIntensity * glowScale;
      const blur2 = baseBlur2 * glowIntensity * glowScale;
      const spreadRadius1 = spread1 * glowIntensity * glowScale;
      const spreadRadius2 = spread2 * glowIntensity * glowScale;

      element.style.boxShadow = `
        0 0 ${blur1}px ${spreadRadius1}px ${glowColor2},
        0 0 ${blur2}px ${spreadRadius2}px ${glowColor}
      `;
      element.style.overflow = "visible";
    } else {
      element.style.boxShadow = "";
      element.style.overflow = "";
    }

    const isSvgActive = opacity > 0 || glowScale !== 1.0;
    if (isSvgActive) {
      element.style.borderRadius = "6.75px";
    } else {
      element.style.borderRadius = "";
    }
  } else {
    element.style.borderRadius = "";
    element.style.boxShadow = "";
  }
}
