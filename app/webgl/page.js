"use client";

import { PlayArrow, PlaylistPlay, Settings, Stop } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
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
const MemoizedBetMultiplier = memo(BetMultiplier);

const MemoizedGlowAnimationWebGL = memo(
  GlowAnimationWebGL,
  (prevProps, nextProps) => {
    return (
      prevProps.anchorEl === nextProps.anchorEl &&
      prevProps.isPlaying === nextProps.isPlaying &&
      prevProps.config === nextProps.config &&
      prevProps.onAnimationComplete === nextProps.onAnimationComplete &&
      prevProps.onGlowIntensityChange === nextProps.onGlowIntensityChange &&
      prevProps.onTimeUpdate === nextProps.onTimeUpdate
    );
  }
);

const GRID_LAYOUT = { cols: 3, rows: 1 };

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

  const hasSvgPath = useMemo(
    () => config.paths?.some((p) => p.type === "svg" && p.enabled !== false),
    [config.paths]
  );

  const multiplierPaths = useMemo(
    () =>
      config.paths?.filter(
        (p) => p.type === "multiplier" && p.enabled !== false
      ) || [],
    [config.paths]
  );

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
      const minLen = Math.min(prev.length, betspotCount);
      for (let i = 0; i < minLen; i++) {
        newEls[i] = prev[i];
      }
      return newEls;
    });

    multiplierRefs.current = Array.from({ length: betspotCount }, () => []);
    currentTimeSecRefs.current = Array.from({ length: betspotCount }, () => 0);

    const maxScaleRef = svgMaxScaleReachedRef.current;
    const prevScaleRef = svgPreviousScaleRef.current;
    const glowPeakRef = svgGlowPeakReachedRef.current;
    const originalSizeRef = betspotOriginalSizeRef.current;

    for (let i = 0; i < betspotCount; i++) {
      maxScaleRef[i] = false;
      prevScaleRef[i] = 1;
      glowPeakRef[i] = false;
      delete originalSizeRef[i];
    }
  }, [
    betspotCount,
    setAnchorEls,
    svgMaxScaleReachedRef,
    svgPreviousScaleRef,
    svgGlowPeakReachedRef,
    betspotOriginalSizeRef,
  ]);

  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${GRID_LAYOUT.cols}, 1fr)`,
      gridTemplateRows: `repeat(${GRID_LAYOUT.rows}, 1fr)`,
      gap: "20px",
    }),
    []
  );

  const multiplierRefCallbacksRef = useRef(new Map());

  const getMultiplierRefCallback = useCallback((index, pathIndex) => {
    const key = `${index}-${pathIndex}`;
    if (!multiplierRefCallbacksRef.current.has(key)) {
      multiplierRefCallbacksRef.current.set(key, (el) => {
        if (!multiplierRefs.current[index]) {
          multiplierRefs.current[index] = [];
        }
        multiplierRefs.current[index][pathIndex] = el;
      });
    }
    return multiplierRefCallbacksRef.current.get(key);
  }, []);

  const animationCompleteHandlersRef = useRef(new Map());

  const getAnimationCompleteHandler = useCallback(
    (index) => {
      if (!animationCompleteHandlersRef.current.has(index)) {
        animationCompleteHandlersRef.current.set(index, () =>
          handleAnimationComplete(index)
        );
      }
      return animationCompleteHandlersRef.current.get(index);
    },
    [handleAnimationComplete]
  );

  const timeUpdateHandlersRef = useRef(new Map());

  const getTimeUpdateHandler = useCallback(
    (index) => {
      if (!timeUpdateHandlersRef.current.has(index)) {
        timeUpdateHandlersRef.current.set(index, (currentTimeSec) =>
          handleTimeUpdate(index, currentTimeSec)
        );
      }
      return timeUpdateHandlersRef.current.get(index);
    },
    [handleTimeUpdate]
  );

  const betspotIndices = useMemo(
    () => Array.from({ length: betspotCount }, (_, i) => i),
    [betspotCount]
  );

  const handleOpenSelector = useCallback(
    () => setSelectorOpen(true),
    [setSelectorOpen]
  );
  const handleOpenConfig = useCallback(
    () => setConfigOpen(true),
    [setConfigOpen]
  );
  const handleCloseConfig = useCallback(
    () => setConfigOpen(false),
    [setConfigOpen]
  );
  const handleCloseSelector = useCallback(
    () => setSelectorOpen(false),
    [setSelectorOpen]
  );

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black">
      <div className="grid" style={gridStyle}>
        {betspotIndices.map((index) => {
          const anchorEl = anchorEls[index];
          const isActive = anchorEl && activeBetspotIndices.includes(index);
          const shouldPlay = isPlaying[index] && selectedBetspots[index];

          return (
            <div
              key={`betspot-${index}`}
              className="relative flex items-center justify-center"
              style={{ overflow: "visible" }}
            >
              <MemoizedBetSpot ref={getAnchorRefCallback(index)} />
              {hasSvgPath && (
                <BetSpotSvg
                  betspotRef={{ current: anchorEl }}
                  svgRef={getSvgRefCallback(index)}
                />
              )}
              <Chip />
              {multiplierPaths.map((multiplierPath, pathIndex) => (
                <MemoizedBetMultiplier
                  key={`multiplier-${index}-${multiplierPath.id || pathIndex}`}
                  text={multiplierPath.text || "50x"}
                  ref={getMultiplierRefCallback(index, pathIndex)}
                />
              ))}
              {isActive && (
                <MemoizedGlowAnimationWebGL
                  key={`glow-${index}-${shouldPlay}`}
                  anchorEl={anchorEl}
                  config={config}
                  isPlaying={shouldPlay}
                  onAnimationComplete={getAnimationCompleteHandler(index)}
                  onGlowIntensityChange={getGlowIntensityHandler(index)}
                  onTimeUpdate={getTimeUpdateHandler(index)}
                />
              )}
            </div>
          );
        })}
      </div>

      <IconButton
        onClick={handleOpenSelector}
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
        onClick={handleOpenConfig}
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
        onClose={handleCloseConfig}
        config={config}
        onConfigChange={setConfig}
      />

      <BetSpotSelectorModal
        open={selectorOpen}
        onClose={handleCloseSelector}
        betspotCount={betspotCount}
        selectedBetspots={selectedBetspots}
        onSelectionChange={handleSelectionChange}
      />
    </div>
  );
}
