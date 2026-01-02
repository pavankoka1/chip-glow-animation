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
 * @param {HTMLElement} props.anchorEl - The anchor element (betspot) to animate around
 * @param {Array} props.anchorEls - Optional: Array of { element, delay? } for multiple betspots
 * @param {Object} props.config - Global configuration object
 * @param {boolean} props.isPlaying - Whether animations are currently playing
 */
export default function BetSpotAnimations({
  anchorEl,
  anchorEls,
  config,
  isPlaying,
}) {
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

  return (
    <>
      {/* Background Gradient - rendered behind factorial-noise, fades in when factorial-noise fades out */}
      {anchorEl && (
        <MemoizedBetSpotBackgroundGradient
          anchorEl={anchorEl}
          pathConfig={{}}
          isPlaying={isPlaying}
          globalConfig={config}
        />
      )}
      {/* Factorial Noise - first layer, rendered below all other animations */}
      {anchorEl &&
        factorialNoisePaths.map((pathConfig) => (
          <MemoizedFactorialNoiseWebGL
            key={pathConfig.id}
            anchorEl={anchorEl}
            pathConfig={pathConfig}
            isPlaying={isPlaying}
            globalConfig={config}
          />
        ))}
      {/* Black Hole Animations - rendered on top of factorial-noise */}
      {anchorEl &&
        blackHolePaths.map((pathConfig) => (
          <MemoizedBlackHoleWebGL
            key={pathConfig.id}
            anchorEl={anchorEl}
            pathConfig={pathConfig}
            isPlaying={isPlaying}
            globalConfig={config}
          />
        ))}
      {/* SVG Animations - rendered inside betspot container for correct positioning */}
      {anchorEl &&
        svgPaths.map((pathConfig) => (
          <MemoizedSvgAnimationWebGL
            key={pathConfig.id}
            anchorEl={anchorEl}
            pathConfig={pathConfig}
            isPlaying={isPlaying}
            globalConfig={config}
          />
        ))}
      {/* Multiplier Animations - rendered inside betspot container for correct positioning */}
      {anchorEl &&
        multiplierPaths.map((pathConfig) => (
          <MemoizedMultiplierWebGL
            key={pathConfig.id}
            anchorEl={anchorEl}
            pathConfig={pathConfig}
            isPlaying={isPlaying}
            globalConfig={config}
          />
        ))}

      {/* Circle Spark Animations */}
      {anchorEl &&
        circleSparkPaths.map((pathConfig) => (
          <MemoizedCircleSparkWebGL
            key={pathConfig.id}
            anchorEl={anchorEl}
            anchorEls={anchorEls}
            pathConfig={pathConfig}
            isPlaying={isPlaying}
            globalConfig={config}
          />
        ))}

      {/* Spark Spin Animations */}
      {anchorEl &&
        sparkSpinPaths.map((pathConfig) => (
          <MemoizedSparkSpinWebGL
            key={pathConfig.id}
            anchorEl={anchorEl}
            anchorEls={anchorEls}
            pathConfig={pathConfig}
            isPlaying={isPlaying}
            globalConfig={config}
          />
        ))}
    </>
  );
}

