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

    // Find background and border groups
    const backgroundGroup = svgElement.querySelector(
      '[data-svg-part="background"]'
    );
    const borderGroup = svgElement.querySelector('[data-svg-part="border"]');

    // Calculate base opacity for background using normal logic
    const isMaxReached = svgMaxScaleReachedRef.current[index];
    let baseOpacity = 0;

    if (isMaxReached) {
      baseOpacity = 1;
    } else if (glowScale === 1.0) {
      baseOpacity = 0;
    } else {
      baseOpacity = Math.min(1, Math.max(0, (glowScale - 1) / 0.1));
    }

    // Apply gradual fade to background in second half
    const svgElapsed = intensities?.svgElapsed;
    const svgDurationSec = intensities?.svgDurationSec;
    let backgroundOpacity = 0;

    if (svgElapsed !== null && svgDurationSec !== null && svgElapsed > 0) {
      if (svgElapsed >= svgDurationSec) {
        backgroundOpacity = 0;
      } else if (svgElapsed > svgDurationSec / 2) {
        // In second half: gradually fade from baseOpacity to 0
        const progressInSecondHalf =
          (svgElapsed - svgDurationSec / 2) / (svgDurationSec / 2);
        backgroundOpacity = baseOpacity * (1 - progressInSecondHalf);
      } else {
        // In first half: use base opacity
        backgroundOpacity = baseOpacity;
      }
    } else if (baseOpacity > 0) {
      // Fallback if timing not available
      backgroundOpacity = baseOpacity;
    }

    // Apply opacity to background group
    if (backgroundGroup) {
      backgroundGroup.style.opacity = backgroundOpacity;
    }

    // Border always stays at full opacity
    if (borderGroup) {
      borderGroup.style.opacity = 1;
    }

    // Keep SVG visible during animation (so border stays visible) or if background/scale indicates activity
    // The border should stay visible throughout the entire animation and after it completes
    // CRITICAL: Only show SVG after delay has passed (svgElapsed > 0 means we're past the delay)
    // svgElapsed is calculated as Math.max(0, currentTimeSec - delaySec), so:
    // - svgElapsed === 0: still in delay period, hide SVG
    // - svgElapsed > 0: past delay, show SVG
    // - svgElapsed === null: no timing info, use fallback logic
    const isPastDelay =
      svgElapsed !== null && svgDurationSec !== null && svgElapsed > 0;
    const isInDelayPeriod = svgElapsed !== null && svgElapsed === 0;

    svgElement.style.transform = `scale(${glowScale}) translateZ(0)`;
    svgElement.style.transformOrigin = "center center";

    // Always keep SVG element visible once animation starts (past delay) so border can be seen
    // The border should stay visible throughout the entire animation and after it completes
    // But respect the delay: hide if we're in the delay period (svgElapsed === 0)
    let isSvgVisible = false;
    if (isInDelayPeriod) {
      // In delay period: hide SVG until delay passes
      svgElement.style.visibility = "hidden";
      svgElement.style.opacity = 0;
      isSvgVisible = false;
    } else if (isPastDelay) {
      // Past delay: show SVG (border should be visible)
      svgElement.style.visibility = "visible";
      svgElement.style.opacity = 1;
      isSvgVisible = true;
    } else if (
      svgElapsed === null &&
      (backgroundOpacity > 0 || glowScale !== 1.0)
    ) {
      // No timing info available but scale/opacity indicates activity: show
      svgElement.style.visibility = "visible";
      svgElement.style.opacity = 1;
      isSvgVisible = true;
    } else {
      // No activity: hide
      svgElement.style.visibility = "hidden";
      svgElement.style.opacity = 0;
      isSvgVisible = false;
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
      glowIntensity =
        glowScale > 1.0 ? Math.min(1, Math.max(0, (glowScale - 1.0) / 0.1)) : 0;
    } else {
      glowIntensity =
        glowScale >= 1.1
          ? 1.0
          : glowScale > 1.0
          ? Math.min(1, Math.max(0, (glowScale - 1.0) / 0.1))
          : 0;
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

    if (isSvgVisible) {
      element.style.borderRadius = "6.75px";
    } else {
      element.style.borderRadius = "";
    }
  } else {
    element.style.borderRadius = "";
    element.style.boxShadow = "";
  }
}
