"use client";

import { PlayArrow, PlaylistPlay, Settings, Stop } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { memo, useEffect, useRef } from "react";
import BetMultiplier from "../components/BetMultiplier";
import BetSpot from "../components/BetSpot";
import BetSpotSelectorModal from "../components/BetSpotSelectorModal";
import BetSpotSvg from "../components/BetSpotSvg";
import Chip from "../components/Chip";
import ConfigModal from "../components/ConfigModal";
import GlowAnimationWebGL from "../components/webgl/GlowAnimationWebGL";
import { DEFAULT_CONFIG } from "./constants/defaultConfig";
import { useAnimationHandlers } from "./hooks/useAnimationHandlers";
import { useAnimationState } from "./hooks/useAnimationState";
import { useGlowEffects } from "./hooks/useGlowEffects";

const MemoizedBetSpot = memo(BetSpot);
const MemoizedBetMultiplier = BetMultiplier;

const MemoizedGlowAnimationWebGL = memo(
  GlowAnimationWebGL,
  (prevProps, nextProps) => {
    return (
      prevProps.anchorEl === nextProps.anchorEl &&
      prevProps.isPlaying === nextProps.isPlaying &&
      prevProps.config === nextProps.config
    );
  }
);

const GRID_LAYOUT = { cols: 1, rows: 1 };

export default function WebGLPage() {
  const animationState = useAnimationState(DEFAULT_CONFIG);
  const {
    config,
    setConfig,
    configOpen,
    setConfigOpen,
    selectorOpen,
    setSelectorOpen,
    betspotCount,
    activeBetspotIndices,
    anchorEls,
    setAnchorEls,
    selectedBetspots,
    isPlaying,
    setIsPlaying,
    isPlayingRef,
    selectedBetspotsRef,
    handleSelectionChange,
    handlePlayPause,
    isAnyPlaying,
  } = animationState;

  const glowEffects = useGlowEffects(betspotCount, config, setAnchorEls);
  const {
    svgMaxScaleReachedRef,
    svgPreviousScaleRef,
    svgGlowPeakReachedRef,
    betspotOriginalSizeRef,
    getAnchorRefCallback,
    getSvgRefCallback,
    getGlowIntensityHandler,
  } = glowEffects;

  const multiplierRefs = useRef(Array.from({ length: betspotCount }, () => []));
  const currentTimeSecRefs = useRef(
    Array.from({ length: betspotCount }, () => 0)
  );
  const prevBetspotCountRef = useRef(betspotCount);

  const { handleAnimationComplete, handleTimeUpdate } = useAnimationHandlers(
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
  );

  useEffect(() => {
    const prevCount = prevBetspotCountRef.current;
    if (prevCount === betspotCount) return;

    prevBetspotCountRef.current = betspotCount;

    setAnchorEls((prev) => {
      const newEls = new Array(betspotCount).fill(null);
      for (let i = 0; i < Math.min(prev.length, betspotCount); i++) {
        newEls[i] = prev[i];
      }
      return newEls;
    });

    multiplierRefs.current = Array.from({ length: betspotCount }, () => []);
    currentTimeSecRefs.current = Array.from({ length: betspotCount }, () => 0);

    for (let i = 0; i < betspotCount; i++) {
      svgMaxScaleReachedRef.current[i] = false;
      svgPreviousScaleRef.current[i] = 1;
      svgGlowPeakReachedRef.current[i] = false;
      delete betspotOriginalSizeRef.current[i];
    }
  }, [
    betspotCount,
    setAnchorEls,
    svgMaxScaleReachedRef,
    svgPreviousScaleRef,
    svgGlowPeakReachedRef,
    betspotOriginalSizeRef,
  ]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${GRID_LAYOUT.cols}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_LAYOUT.rows}, 1fr)`,
          gap: "20px",
        }}
      >
        {Array.from({ length: betspotCount }).map((_, index) => (
          <div
            key={`betspot-${index}`}
            className="relative flex items-center justify-center"
            style={{ overflow: "visible" }}
          >
            <MemoizedBetSpot ref={getAnchorRefCallback(index)} />
            {config.paths?.some(
              (p) => p.type === "svg" && p.enabled !== false
            ) && (
              <BetSpotSvg
                betspotRef={{ current: anchorEls[index] }}
                svgRef={getSvgRefCallback(index)}
              />
            )}
            <Chip />
            {config.paths
              ?.filter((p) => p.type === "multiplier" && p.enabled !== false)
              .map((multiplierPath, pathIndex) => (
                <MemoizedBetMultiplier
                  key={`multiplier-${index}-${multiplierPath.id || pathIndex}`}
                  text={multiplierPath.text || "50x"}
                  ref={(el) => {
                    if (!multiplierRefs.current[index]) {
                      multiplierRefs.current[index] = [];
                    }
                    multiplierRefs.current[index][pathIndex] = el;
                  }}
                />
              ))}
            {anchorEls[index] && activeBetspotIndices.includes(index) && (
              <MemoizedGlowAnimationWebGL
                key={`glow-${index}-${isPlaying[index]}`}
                anchorEl={anchorEls[index]}
                config={config}
                isPlaying={isPlaying[index] && selectedBetspots[index]}
                onAnimationComplete={() => handleAnimationComplete(index)}
                onGlowIntensityChange={getGlowIntensityHandler(index)}
                onTimeUpdate={(currentTimeSec) => {
                  handleTimeUpdate(index, currentTimeSec);
                }}
              />
            )}
          </div>
        ))}
      </div>

      <IconButton
        onClick={() => setSelectorOpen(true)}
        sx={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 1000,
          bgcolor: "rgba(255, 215, 0, 0.1)",
          color: "#FFD700",
          border: "2px solid #FFD700",
          "&:hover": {
            bgcolor: "rgba(255, 215, 0, 0.2)",
            borderColor: "#FFA500",
            color: "#FFA500",
          },
        }}
        title="Select BetSpots"
      >
        <PlaylistPlay />
      </IconButton>

      <IconButton
        onClick={handlePlayPause}
        sx={{
          position: "fixed",
          top: 16,
          left: 80,
          zIndex: 1000,
          bgcolor: "rgba(255, 215, 0, 0.1)",
          color: "#FFD700",
          border: "2px solid #FFD700",
          "&:hover": {
            bgcolor: "rgba(255, 215, 0, 0.2)",
            borderColor: "#FFA500",
            color: "#FFA500",
          },
        }}
        title={isAnyPlaying ? "Stop Animation" : "Play Animation"}
      >
        {isAnyPlaying ? (
          <Stop />
        ) : (
          <PlayArrow sx={{ transform: "translateX(2px)" }} />
        )}
      </IconButton>

      <IconButton
        onClick={() => setConfigOpen(true)}
        sx={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1000,
          bgcolor: "rgba(255, 255, 255, 0.1)",
          color: "white",
          "&:hover": {
            bgcolor: "rgba(255, 255, 255, 0.2)",
          },
        }}
      >
        <Settings />
      </IconButton>

      <ConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        config={config}
        onConfigChange={setConfig}
      />

      <BetSpotSelectorModal
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        betspotCount={betspotCount}
        selectedBetspots={selectedBetspots}
        onSelectionChange={handleSelectionChange}
      />
    </div>
  );
}
