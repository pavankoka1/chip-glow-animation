"use client";

import { PlayArrow, PlaylistPlay, Settings, Stop } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
      prevProps.onTimeUpdate === nextProps.onTimeUpdate &&
      prevProps.scrubTime === nextProps.scrubTime
    );
  }
);

const GRID_LAYOUT = { cols: 1, rows: 1 };

// Separate Slider component to ensure high-performance dragging
const ScrubSlider = memo(
  ({ value, max, onChange, onModeToggle, isScrubbing }) => {
    const [localValue, setLocalValue] = useState(value || 0);
    const isDragging = useRef(false);

    useEffect(() => {
      if (!isDragging.current) {
        setLocalValue(value || 0);
      }
    }, [value]);

    const handleChange = (e) => {
      const val = parseFloat(e.target.value);
      setLocalValue(val);
      onChange(val);
    };

    return (
      <div className="bg-black/80 rounded-lg p-4 border border-white/20 w-[80vw] max-w-4xl shadow-2xl">
        <div className="flex justify-between items-center mb-3">
          <label className="text-white text-sm font-medium">
            Timeframe:{" "}
            <span className="text-yellow-500 font-mono">
              {localValue.toFixed(3)}s
            </span>
          </label>
          <button
            onClick={onModeToggle}
            className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
              isScrubbing
                ? "bg-yellow-500 text-black hover:bg-yellow-400"
                : "bg-gray-700 text-white hover:bg-gray-600"
            }`}
          >
            {isScrubbing ? "SCRUBBING" : "LIVE"}
          </button>
        </div>
        <input
          type="range"
          min="0"
          max={max}
          step="0.001"
          value={localValue}
          onMouseDown={() => (isDragging.current = true)}
          onMouseUp={() => (isDragging.current = false)}
          onInput={handleChange}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
        />
      </div>
    );
  }
);

export default function WebGLPage() {
  const [scrubTime, setScrubTime] = useState(null);
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
  const { getAnchorRefCallback, getSvgRefCallback, getGlowIntensityHandler } =
    glowEffects;

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
      for (let i = 0; i < minLen; i++) newEls[i] = prev[i];
      return newEls;
    });
    multiplierRefs.current = Array.from({ length: betspotCount }, () => []);
    currentTimeSecRefs.current = Array.from({ length: betspotCount }, () => 0);
  }, [betspotCount, setAnchorEls]);

  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${GRID_LAYOUT.cols}, 1fr)`,
      gridTemplateRows: `repeat(${GRID_LAYOUT.rows}, 1fr)`,
      gap: "20px",
    }),
    []
  );

  const getMultiplierRefCallback = useCallback((index, pathIndex) => {
    const key = `${index}-${pathIndex}`;
    return (el) => {
      if (!multiplierRefs.current[index]) multiplierRefs.current[index] = [];
      multiplierRefs.current[index][pathIndex] = el;
    };
  }, []);

  const getAnimationCompleteHandler = useCallback(
    (index) => () => handleAnimationComplete(index),
    [handleAnimationComplete]
  );
  const getTimeUpdateHandler = useCallback(
    (index) => (t) => handleTimeUpdate(index, t),
    [handleTimeUpdate]
  );

  const maxDuration = useMemo(() => {
    if (!config.paths) return 0;
    return Math.max(
      ...config.paths.map(
        (p) =>
          (p.delay || 0) / 1000 +
          (p.animationTimeMs || config.animationTimeMs || 800) / 1000 +
          0.5
      ),
      0
    );
  }, [config]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black overflow-hidden relative">
      <div className="grid" style={gridStyle}>
        {Array.from({ length: betspotCount }).map((_, index) => {
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
              <Chip />
              {multiplierPaths.map((multiplierPath, pathIndex) => (
                <MemoizedBetMultiplier
                  key={`multiplier-${index}-${multiplierPath.id || pathIndex}`}
                  text={multiplierPath.text || "50x"}
                  ref={getMultiplierRefCallback(index, pathIndex)}
                />
              ))}
              {hasSvgPath && (
                <BetSpotSvg
                  betspotRef={{ current: anchorEl }}
                  svgRef={getSvgRefCallback(index)}
                />
              )}
              {isActive && (
                <MemoizedGlowAnimationWebGL
                  key={`glow-${index}-${shouldPlay}`}
                  anchorEl={anchorEl}
                  config={config}
                  isPlaying={shouldPlay}
                  onAnimationComplete={getAnimationCompleteHandler(index)}
                  onGlowIntensityChange={getGlowIntensityHandler(index)}
                  onTimeUpdate={getTimeUpdateHandler(index)}
                  scrubTime={scrubTime}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Controls */}
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
          "&:hover": { bgcolor: "rgba(255, 255, 255, 0.2)" },
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

      {/* Bottom Bar with Sliders */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10 flex flex-col gap-4 items-center">
        {/* High-Performance Time Scrubber */}
        <ScrubSlider
          value={scrubTime}
          max={maxDuration}
          onChange={setScrubTime}
          isScrubbing={scrubTime !== null}
          onModeToggle={() => setScrubTime(scrubTime === null ? 0 : null)}
        />
      </div>
    </div>
  );
}
