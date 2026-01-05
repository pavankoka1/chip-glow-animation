"use client";

import { memo } from "react";
import BetSpotBackgroundGradient from "../BetSpotBackgroundGradient/BetSpotBackgroundGradient";
import BlackHoleWebGL from "../BlackHoleWebGL/BlackHoleWebGL";
import CircleSparkWebGL from "../CircleSparkWebGL/CircleSparkWebGL";
import FactorialNoiseWebGL from "../FactorialNoiseWebGL/FactorialNoiseWebGL";
import MultiplierWebGL from "../MultiplierWebGL/MultiplierWebGL";
import SparkSpinWebGL from "../SparkSpinWebGL/SparkSpinWebGL";
import SvgAnimationWebGL from "../SvgAnimationWebGL/SvgAnimationWebGL";

const MemoizedBetSpotBackgroundGradient = memo(BetSpotBackgroundGradient);
const MemoizedBlackHoleWebGL = memo(BlackHoleWebGL);
const MemoizedCircleSparkWebGL = memo(CircleSparkWebGL);
const MemoizedSparkSpinWebGL = memo(SparkSpinWebGL);
const MemoizedSvgAnimationWebGL = memo(SvgAnimationWebGL);
const MemoizedFactorialNoiseWebGL = memo(FactorialNoiseWebGL);
const MemoizedMultiplierWebGL = memo(MultiplierWebGL);

/**
 * BetSpotAnimations - Wraps and controls all animation components
 * @param {Object} props
 * @param {HTMLElement} props.anchorEl - The anchor element (betspot) to animate around (legacy, for backward compatibility)
 * @param {Array} props.anchorEls - Array of { element, delay? } for multiple betspots
 * @param {Object} props.config - Global configuration object
 * @param {boolean} props.isPlaying - Whether animations are currently playing
 * @param {Array} props.renderOnly - Optional: Array of animation types to render (e.g., ["svg", "multiplier"])
 */
export default function BetSpotAnimations({
  anchorEl,
  anchorEls,
  config,
  isPlaying,
  renderOnly = null, // If provided, only render these animation types
}) {
  // Normalize anchorEls: use anchorEls array if provided, otherwise fall back to single anchorEl
  const normalizedAnchorEls = anchorEls && anchorEls.length > 0 
    ? anchorEls 
    : anchorEl 
      ? [{ element: anchorEl, delay: 0 }]
      : [];

  // Get the first anchorEl for animations that don't support multiple yet (backward compatibility)
  const firstAnchorEl = normalizedAnchorEls[0]?.element || anchorEl;
  // Get enabled circle-spark paths
  const circleSparkPaths =
    config.paths?.filter(
      (p) => p.type === "circle-spark" && p.enabled !== false
    ) || [];

  // Get enabled spark-spin paths
  const sparkSpinPaths =
    config.paths?.filter(
      (p) => p.type === "spark-spin" && p.enabled !== false
    ) || [];

  // Get enabled svg paths
  const svgPaths =
    config.paths?.filter((p) => p.type === "svg" && p.enabled !== false) || [];

  // Get enabled factorial-noise paths
  const factorialNoisePaths =
    config.paths?.filter(
      (p) => p.type === "factorial-noise" && p.enabled !== false
    ) || [];

  // Get enabled black-hole paths
  const blackHolePaths =
    config.paths?.filter(
      (p) => p.type === "black-hole" && p.enabled !== false
    ) || [];

  // Get enabled multiplier paths
  const multiplierPaths =
    config.paths?.filter(
      (p) => p.type === "multiplier" && p.enabled !== false
    ) || [];

  // Helper to check if an animation type should be rendered
  const shouldRender = (type) => {
    if (!renderOnly) return true;
    return renderOnly.includes(type);
  };
  
  return (
    <>
      {/* Background Gradient - rendered behind factorial-noise, fades in when factorial-noise fades out */}
      {shouldRender("background") && normalizedAnchorEls.map((ae, index) => (
        <MemoizedBetSpotBackgroundGradient
          key={`bg-${index}`}
          anchorEl={ae.element}
          pathConfig={{}}
          isPlaying={isPlaying}
          globalConfig={config}
        />
      ))}
      
      {/* Factorial Noise - first layer, rendered below all other animations */}
      {shouldRender("factorial-noise") && normalizedAnchorEls.map((ae, betspotIndex) =>
        factorialNoisePaths.map((pathConfig) => (
          <MemoizedFactorialNoiseWebGL
            key={`factorial-${betspotIndex}-${pathConfig.id}`}
            anchorEl={ae.element}
            pathConfig={pathConfig}
            isPlaying={isPlaying}
            globalConfig={config}
          />
        ))
      )}
      
      {/* Black Hole Animations - rendered on top of factorial-noise */}
      {shouldRender("black-hole") && normalizedAnchorEls.map((ae, betspotIndex) =>
        blackHolePaths.map((pathConfig) => (
          <MemoizedBlackHoleWebGL
            key={`blackhole-${betspotIndex}-${pathConfig.id}`}
            anchorEl={ae.element}
            pathConfig={pathConfig}
            isPlaying={isPlaying}
            globalConfig={config}
          />
        ))
      )}
      
      {/* SVG Animations - rendered inside betspot container for correct positioning */}
      {shouldRender("svg") && normalizedAnchorEls.map((ae, betspotIndex) =>
        svgPaths.map((pathConfig) => (
          <MemoizedSvgAnimationWebGL
            key={`svg-${betspotIndex}-${pathConfig.id}`}
            anchorEl={ae.element}
            pathConfig={pathConfig}
            isPlaying={isPlaying}
            globalConfig={config}
          />
        ))
      )}
      
      {/* Multiplier Animations - rendered inside betspot container for correct positioning */}
      {shouldRender("multiplier") && normalizedAnchorEls.map((ae, betspotIndex) =>
        multiplierPaths.map((pathConfig) => (
          <MemoizedMultiplierWebGL
            key={`multiplier-${betspotIndex}-${pathConfig.id}`}
            anchorEl={ae.element}
            pathConfig={pathConfig}
            isPlaying={isPlaying}
            globalConfig={config}
          />
        ))
      )}

      {/* Circle Spark Animations - supports multiple anchorEls with delays */}
      {shouldRender("circle-spark") && circleSparkPaths.map((pathConfig) => (
        <MemoizedCircleSparkWebGL
          key={pathConfig.id}
          anchorEl={firstAnchorEl} // Legacy fallback
          anchorEls={normalizedAnchorEls} // Array with delays
          pathConfig={pathConfig}
          isPlaying={isPlaying}
          globalConfig={config}
        />
      ))}

      {/* Spark Spin Animations - supports multiple anchorEls with delays */}
      {shouldRender("spark-spin") && sparkSpinPaths.map((pathConfig) => (
        <MemoizedSparkSpinWebGL
          key={pathConfig.id}
          anchorEl={firstAnchorEl} // Legacy fallback
          anchorEls={normalizedAnchorEls} // Array with delays
          pathConfig={pathConfig}
          isPlaying={isPlaying}
          globalConfig={config}
        />
      ))}
    </>
  );
}

