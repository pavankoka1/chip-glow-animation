/**
 * Pre-computation utilities for animation paths
 * Pre-computes static values that don't change during animation
 */

import { delayToSeconds, hexToRgb } from "../../canvas2d/utils";

/**
 * Pre-computes static values for a path that don't change during animation
 * @param {Object} path - Animation path configuration
 * @param {Object} cfg - Global config with defaults
 * @returns {Object} Pre-computed path data
 */
export function precomputePathData(path, cfg) {
  const delayRaw = path.delay || 0;
  const delaySec = delayToSeconds(delayRaw);
  const animationTimeMs = path.animationTimeMs ?? cfg.animationTimeMs ?? 800;
  const durationSec = animationTimeMs / 1000.0;

  // Pre-compute path type flags
  const isCirclePath =
    path.type === "circle" || path.circleRadius !== undefined;
  const isLinePath = path.type === "line";
  const isSpinPath = path.type === "spin";
  const isObjectGlowPath = path.type === "objectGlow";
  const isSvgPath = path.type === "svg";
  const isMultiplierPath = path.type === "multiplier";

  // Pre-compute default values
  const headRadius = path.headRadius ?? cfg.headRadius ?? 10;
  const tailRadius = path.tailRadius ?? cfg.tailRadius ?? 2;
  const sparkColor = path.sparkColor ?? cfg.sparkColor ?? "#ffff00";
  const glowColor = path.glowColor ?? cfg.glowColor ?? "#fff391";
  const glowRadius = path.glowRadius ?? cfg.glowRadius ?? 30;
  const dotCount = path.dotCount ?? cfg.dotCount ?? null;
  const length = path.length ?? cfg.length ?? null;

  // Pre-compute color RGB values (normalized)
  const sparkColorRgbRaw = hexToRgb(sparkColor);
  const glowColorRgbRaw = hexToRgb(glowColor);
  const sparkColorRgb = [
    sparkColorRgbRaw[0] / 255.0,
    sparkColorRgbRaw[1] / 255.0,
    sparkColorRgbRaw[2] / 255.0,
  ];
  const glowColorRgb = [
    glowColorRgbRaw[0] / 255.0,
    glowColorRgbRaw[1] / 255.0,
    glowColorRgbRaw[2] / 255.0,
  ];

  // Pre-compute spin border color if it's a spin path
  let borderColorRgb = null;
  if (isSpinPath && path.borderColor) {
    const borderColor = path.borderColor;
    borderColorRgb = {
      r: Number.parseInt(borderColor.slice(1, 3), 16),
      g: Number.parseInt(borderColor.slice(3, 5), 16),
      b: Number.parseInt(borderColor.slice(5, 7), 16),
    };
  }

  // Pre-compute fade values
  const fadeIn = path.fadeIn ?? cfg.fadeIn ?? 0;
  const fadeOut = path.fadeOut ?? cfg.fadeOut ?? 0;
  const fadeInSec = fadeIn / 1000.0;
  const fadeOutSec = fadeOut / 1000.0;

  // Pre-compute objectGlow specific values
  let objectGlowData = null;
  if (isObjectGlowPath) {
    objectGlowData = {
      firstHalfDuration: 0.5,
      scaleRange: 0.1, // 1.0 to 1.1
      intensityRange: 1.5,
    };
  }

  // Pre-compute svg specific values
  // SVG animation: first half scale up to max, second half scale down to 1, then stay at 1
  let svgData = null;
  if (isSvgPath) {
    const maxScale = path.maxScale ?? 1.1; // Same as objectGlow default
    svgData = {
      firstHalfDuration: 0.5, // First half of animation time
      maxScale,
      scaleRange: maxScale - 1.0, // Range from 1.0 to maxScale
    };
  }

  // Pre-compute spin border specific values
  let spinBorderData = null;
  if (isSpinPath) {
    const fadeInMs = 300;
    const fadeOutMs = 300;
    const backgroundGradient = path.backgroundGradient;
    spinBorderData = {
      fadeInSec: fadeInMs / 1000.0,
      fadeOutSec: fadeOutMs / 1000.0,
      borderWidth: path.borderWidth ?? 2,
      borderRadius: path.borderRadius ?? 5,
      borderColor: path.borderColor ?? "#eaa13b",
      borderColorRgb,
      backgroundGradient: backgroundGradient
        ? {
            centerColor: backgroundGradient.centerColor ?? "#834F03",
            midColor: backgroundGradient.midColor ?? "#9C6004",
            edgeColor: backgroundGradient.edgeColor ?? "#CE9404",
            midStop: backgroundGradient.midStop ?? 40.8232,
          }
        : null,
    };
  }

  return {
    // Path identification
    id: path.id,
    type: path.type,
    isCirclePath,
    isLinePath,
    isSpinPath,
    isObjectGlowPath,
    isSvgPath,
    isMultiplierPath,

    // Timing (pre-computed)
    delayRaw,
    delaySec,
    animationTimeMs,
    durationSec,

    // Visual properties (pre-computed)
    headRadius,
    tailRadius,
    sparkColor,
    glowColor,
    glowRadius,
    dotCount,
    length,
    sparkColorRgb,
    glowColorRgb,

    // Fade properties (pre-computed)
    fadeIn,
    fadeOut,
    fadeInSec,
    fadeOutSec,

    // Path-specific pre-computed data
    objectGlowData,
    svgData,
    spinBorderData,

    // Keep original path for any dynamic lookups
    originalPath: path,
  };
}

/**
 * Pre-computes data for all active paths
 * @param {Array} activePaths - Array of active animation paths
 * @param {Object} cfg - Global config with defaults
 * @returns {Array} Array of pre-computed path data
 */
export function precomputeAllPaths(activePaths, cfg) {
  return activePaths.map((path) => precomputePathData(path, cfg));
}

/**
 * Finds pre-computed paths by type
 * @param {Array} precomputedPaths - Array of pre-computed path data
 * @param {string} type - Path type to find
 * @returns {Object|null} Pre-computed path data or null
 */
export function findPrecomputedPathByType(precomputedPaths, type) {
  return precomputedPaths.find((p) => p.type === type) || null;
}
