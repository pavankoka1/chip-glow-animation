"use client";

import { PlayArrow, PlaylistPlay, Settings, Stop } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import BetMultiplier from "../components/BetMultiplier";
import BetSpot from "../components/BetSpot";
import BetSpotSelectorModal from "../components/BetSpotSelectorModal";
import Chip from "../components/Chip";
import ConfigModal from "../components/ConfigModal";
import { delayToSeconds } from "../components/canvas2d/utils";
import GlowAnimationWebGL from "../components/webgl/GlowAnimationWebGL";

// Memoize BetSpot - it's now simple and doesn't need prop comparison
const MemoizedBetSpot = memo(BetSpot);
// Don't memoize BetMultiplier - it needs to update every frame for smooth animation
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

const MAX_BETSPOT_COUNT = 10;
const DEFAULT_BETSPOT_COUNT = 1;

// Calculate optimal grid layout (rows and columns as equal as possible)
function calculateGridLayout(count) {
  if (count <= 0) return { cols: 1, rows: 1 };
  if (count === 1) return { cols: 1, rows: 1 };

  // Find the factor pair closest to a square
  let bestCols = Math.ceil(Math.sqrt(count));
  let bestRows = Math.ceil(count / bestCols);

  // Try to find a better arrangement
  for (let cols = Math.floor(Math.sqrt(count)); cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    if (cols * rows >= count) {
      // Check if this is more square-like
      const aspectRatio = Math.max(cols, rows) / Math.min(cols, rows);
      const bestAspectRatio =
        Math.max(bestCols, bestRows) / Math.min(bestCols, bestRows);
      if (aspectRatio < bestAspectRatio) {
        bestCols = cols;
        bestRows = rows;
      }
    }
  }

  return { cols: bestCols, rows: bestRows };
}

export default function WebGLPage() {
  const [configOpen, setConfigOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [config, setConfig] = useState({
    betspotCount: DEFAULT_BETSPOT_COUNT,
    animationTimeMs: 1200,
    glowRadius: 5,
    ellipse: { b: 20, a: 76 },
    headRadius: 5,
    tailRadius: 1,
    length: 80,
    sparkColor: "#f1eb9d",
    glowColor: "#fdcb3d",
    paths: [
      {
        id: 1,
        type: "spark",
        startVertex: "BR",
        animationTimeMs: 750,
        endVertex: "TL",
        delay: 0,
        ellipseTiltDeg: -45,
        ellipseRotationDeg: -2,
        enabled: true,
      },
      {
        id: 2,
        type: "spark",
        startVertex: "BL",
        endVertex: "TR",
        delay: 170,
        animationTimeMs: 710,
        ellipseTiltDeg: 45,
        ellipseRotationDeg: 2,
        enabled: true,
      },
      {
        id: 7,
        type: "spark",
        startVertex: "L",
        endVertex: "R",
        delay: 380,
        animationTimeMs: 1040,
        enabled: true,
      },
      // {
      //   id: 3,
      //   type: "circle",
      //   animationTimeMs: 1200,
      //   startVertex: "BR",
      //   circleRadius: 25,
      //   delay: 650,
      //   enabled: true,
      //   fadeOut: 400,
      // },
      // {
      //   id: 4,
      //   type: "circle",
      //   animationTimeMs: 1200,
      //   startVertex: "BL",
      //   circleRadius: 25,
      //   delay: 750,
      //   direction: "anticlockwise",
      //   enabled: true,
      //   fadeOut: 400,
      // },
      // {
      //   id: 5,
      //   type: "line",
      //   animationTimeMs: 1000,
      //   startPoint: 315,
      //   lineWidth: 2, // Line thickness
      //   iterations: 1,
      //   glowRadius: 5, // Border glow during line animation
      //   delay: 380,
      //   direction: "clockwise",
      //   sparkColor: "#fdcb3d",
      //   glowColor: "#fdcb3d",
      //   enabled: true,
      //   fadeOut: 400,
      // },
      // {
      //   id: 6,
      //   type: "line",
      //   animationTimeMs: 1000,
      //   startPoint: 135,
      //   lineWidth: 4,
      //   iterations: 1,
      //   glowRadius: 0,
      //   delay: 1000,
      //   direction: "clockwise",
      //   sparkColor: "#fdcb3d",
      //   enabled: true,
      //   fadeOut: 400,
      // },
      {
        id: 8,
        type: "objectGlow",
        delay: 540,
        animationTimeMs: 1000,
        enabled: true,
      },
      {
        id: 9,
        type: "spin",
        delay: 380,
        animationTimeMs: 14500,
        enabled: true,
        borderWidth: 3,
        borderRadius: 10,
        borderColor: "#eaa13b",
        tailColor: "#eaa13b",
        lineWidth: 2,
        headWidth: 5,
        tailWidth: 4,
      },
      {
        id: 10,
        type: "multiplier",
        delay: 780,
        animationTimeMs: 1930, // 130 + 250 + 1250 + 300
        enabled: true,
        phase1Duration: 130,
        phase2Duration: 250,
        phase3Duration: 1250,
        phase4Duration: 300,
        maxScale: 1.2,
        text: "50x",
      },
    ],
  });

  const betspotCount = Math.min(
    Math.max(1, config.betspotCount || DEFAULT_BETSPOT_COUNT),
    MAX_BETSPOT_COUNT
  );
  const gridLayout = useMemo(
    () => calculateGridLayout(betspotCount),
    [betspotCount]
  );

  // Store refs in a ref object (not accessed during render)
  const betspotRefsStorage = useRef({});
  const [anchorEls, setAnchorEls] = useState(() =>
    Array(betspotCount).fill(null)
  );

  // Batch glow intensity updates to reduce re-render frequency
  const glowIntensityUpdateQueueRef = useRef(new Map());
  const glowIntensityUpdateTimeoutRef = useRef(null);

  // Create stable ref callback factory to prevent infinite loops
  const createAnchorRefCallback = useCallback((index) => {
    return (el) => {
      betspotRefsStorage.current[index] = el;
      // Only update if state doesn't already match - prevents infinite loops
      setAnchorEls((prev) => {
        if (prev[index] === el) {
          return prev; // No change, return same reference
        }
        const newEls = [...prev];
        newEls[index] = el;
        return newEls;
      });
    };
  }, []);

  // Cache ref callbacks to prevent recreation
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
  const [selectedBetspots, setSelectedBetspots] = useState(() =>
    Array(betspotCount).fill(true)
  );
  const [isPlaying, setIsPlaying] = useState(() =>
    Array(betspotCount).fill(false)
  );
  // Store isPlaying and selectedBetspots in refs to avoid closure issues in callbacks
  const isPlayingRef = useRef(isPlaying);
  const selectedBetspotsRef = useRef(selectedBetspots);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    selectedBetspotsRef.current = selectedBetspots;
  }, [selectedBetspots]);
  // CRITICAL FIX: Array.fill() with object creates shared reference - use map instead
  const [glowIntensities, setGlowIntensities] = useState(() =>
    Array.from({ length: betspotCount }, () => ({
      chipGlowIntensity: 0,
      perimeterGlowIntensity: 0,
      glowScale: 1,
    }))
  );
  // Multiplier animation refs - store element refs and animation state
  // Support multiple multipliers per betspot (array of refs)
  const multiplierRefs = useRef(Array.from({ length: betspotCount }, () => []));
  // Store current time from main animation loop for each betspot
  const currentTimeSecRefs = useRef(
    Array.from({ length: betspotCount }, () => 0)
  );

  // Helper function to apply glow effects directly to DOM (declared before use)
  const applyGlowToElement = useCallback((element, intensities) => {
    if (!element) return;

    const glowColor = "rgba(253, 203, 61, 1)";
    const chipGlowIntensity = intensities?.chipGlowIntensity || 0;
    const perimeterGlowIntensity = intensities?.perimeterGlowIntensity || 0;
    const glowScale = intensities?.glowScale || 1;

    // Calculate glow effects
    const chipGlowOpacity = chipGlowIntensity;
    const chipGlowSpread = 30 * chipGlowIntensity * glowScale;
    const chipGlowBlur = 20 * chipGlowIntensity * glowScale;

    const perimeterGlowOpacity = perimeterGlowIntensity;
    const perimeterGlowBlur = 10 * perimeterGlowIntensity * glowScale;

    // Combine both glows
    const hasChipGlow = chipGlowIntensity > 0;
    const hasPerimeterGlow = perimeterGlowIntensity > 0;

    // Apply styles directly to DOM
    // Base chip color with glow overlay
    element.style.backgroundColor = hasChipGlow
      ? `rgba(${166 + (253 - 166) * chipGlowOpacity}, ${
          96 + (203 - 96) * chipGlowOpacity
        }, ${37 + (61 - 37) * chipGlowOpacity}, 1)`
      : "#a4242f";

    // Box shadow for chip glow (covers entire chip)
    element.style.boxShadow = hasChipGlow
      ? `inset 0 0 ${chipGlowBlur}px ${glowColor.replace(
          "1)",
          `${chipGlowOpacity})`
        )}, 0 0 ${chipGlowSpread}px ${glowColor.replace(
          "1)",
          `${chipGlowOpacity * 0.6})`
        )}`
      : "none";

    // Filter for perimeter glow (around edges)
    element.style.filter = hasPerimeterGlow
      ? `drop-shadow(0 0 ${perimeterGlowBlur}px ${glowColor.replace(
          "1)",
          `${perimeterGlowOpacity * 0.8})`
        )})`
      : "none";

    // Smooth scale transformation for the entire chip
    element.style.transform = `scale(${glowScale})`;
    element.style.transformOrigin = "center center";
  }, []);

  // Apply initial glow effects and reset when needed (fallback for state-based updates)
  useEffect(() => {
    glowIntensities.forEach((intensity, index) => {
      const element = betspotRefsStorage.current[index];
      if (element) {
        applyGlowToElement(element, intensity);
      }
    });
  }, [glowIntensities, applyGlowToElement]);

  // Update arrays when betspot count changes
  const prevBetspotCountRef = useRef(betspotCount);
  useEffect(() => {
    if (prevBetspotCountRef.current === betspotCount) return;
    prevBetspotCountRef.current = betspotCount;

    // Clear cached ref callbacks when betspot count changes
    anchorRefCallbacksRef.current = {};

    setAnchorEls((prev) => {
      const newEls = Array(betspotCount).fill(null);
      for (let i = 0; i < Math.min(prev.length, betspotCount); i++) {
        newEls[i] = prev[i];
      }
      return newEls;
    });
    setSelectedBetspots((prev) => {
      const newSelected = Array(betspotCount).fill(true);
      for (let i = 0; i < Math.min(prev.length, betspotCount); i++) {
        newSelected[i] = prev[i];
      }
      return newSelected;
    });
    setIsPlaying((prev) => {
      const newPlaying = Array(betspotCount).fill(false);
      for (let i = 0; i < Math.min(prev.length, betspotCount); i++) {
        newPlaying[i] = prev[i];
      }
      return newPlaying;
    });
    // Fix: Recreate glowIntensities array with unique objects
    setGlowIntensities((prev) =>
      Array.from({ length: betspotCount }, (_, i) => {
        // Preserve existing values if available
        const existing = prev[i];
        return (
          existing || {
            chipGlowIntensity: 0,
            perimeterGlowIntensity: 0,
            glowScale: 1.0,
          }
        );
      })
    );
    // Reset multiplier refs (array for multiple multipliers per betspot)
    multiplierRefs.current = Array.from({ length: betspotCount }, () => []);
    // Reset current time refs
    currentTimeSecRefs.current = Array.from({ length: betspotCount }, () => 0);
  }, [betspotCount]);

  const handleSelectionChange = (selection) => {
    setSelectedBetspots(selection);
    // Reset playing state based on selection
    const newPlaying = Array(betspotCount).fill(false);
    selection.forEach((selected, index) => {
      if (selected) {
        newPlaying[index] = true;
      }
    });
    setIsPlaying(newPlaying);
  };

  const handleAnimationComplete = (betspotIndex) => {
    setIsPlaying((prev) => {
      const newPlaying = [...prev];
      newPlaying[betspotIndex] = false;
      return newPlaying;
    });
  };

  // Create memoized handlers for each betspot to prevent infinite loops
  const glowIntensityHandlersRef = useRef({});

  // Batch glow intensity updates to reduce re-render frequency
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

  // Process multiplier animations from config using elapsed time (same as other animations)
  const updateMultiplierAnimations = useCallback(
    (index, currentTimeSec) => {
      const multiplierElements = multiplierRefs.current[index];
      if (!multiplierElements || multiplierElements.length === 0) return;

      const cfg = config;
      const multiplierPaths = (cfg.paths || []).filter(
        (p) => p.type === "multiplier" && p.enabled !== false
      );

      multiplierPaths.forEach((multiplierPath, pathIndex) => {
        const multiplierEl = multiplierElements[pathIndex];
        if (!multiplierEl) return;

        // Use same timing system as other animations
        const delayRaw = multiplierPath.delay || 0;
        const delaySec = delayToSeconds(delayRaw);
        const elapsed = Math.max(0, currentTimeSec - delaySec);
        const durationSec = (multiplierPath.animationTimeMs || 1930) / 1000.0;

        // Get phase durations from config or use defaults
        const PHASE1_DURATION = (multiplierPath.phase1Duration || 130) / 1000.0;
        const PHASE2_DURATION = (multiplierPath.phase2Duration || 250) / 1000.0;
        const PHASE3_DURATION =
          (multiplierPath.phase3Duration || 1250) / 1000.0;
        const PHASE4_DURATION = (multiplierPath.phase4Duration || 300) / 1000.0;
        const maxScale = multiplierPath.maxScale || 1.2;

        const phase1Start = 0;
        const phase2Start = phase1Start + PHASE1_DURATION;
        const phase3Start = phase2Start + PHASE2_DURATION;
        const phase4Start = phase3Start + PHASE3_DURATION;
        // Use durationSec from config, but ensure it's at least as long as all phases
        const calculatedTotalDuration = phase4Start + PHASE4_DURATION;
        const totalDuration = Math.max(durationSec, calculatedTotalDuration);

        let scale = 0;
        let opacity = 0;

        if (elapsed < 0 || elapsed >= durationSec) {
          // Before delay or after animation complete
          scale = 0;
          opacity = 0;
        } else if (elapsed < phase2Start) {
          // Phase 1: 0 -> maxScale scale, 0 -> 1 opacity
          const phase1Progress = Math.min(
            1,
            Math.max(0, elapsed / PHASE1_DURATION)
          );
          scale = 0 + (maxScale - 0) * phase1Progress;
          opacity = 0 + (1 - 0) * phase1Progress;
        } else if (elapsed < phase3Start) {
          // Phase 2: maxScale -> 1 scale, opacity 1
          const phase2Progress = Math.min(
            1,
            Math.max(0, (elapsed - phase2Start) / PHASE2_DURATION)
          );
          scale = maxScale + (1 - maxScale) * phase2Progress;
          opacity = 1;
        } else if (elapsed < phase4Start) {
          // Phase 3: scale 1, opacity 1 (hold)
          scale = 1;
          opacity = 1;
        } else if (elapsed < phase4Start + PHASE4_DURATION) {
          // Phase 4: 1 -> 0 scale, 1 -> 0 opacity
          const phase4Progress = Math.min(
            1,
            Math.max(0, (elapsed - phase4Start) / PHASE4_DURATION)
          );
          scale = 1 + (0 - 1) * phase4Progress;
          opacity = 1 + (0 - 1) * phase4Progress;
        } else {
          // After all phases but before durationSec ends - stay at 0
          scale = 0;
          opacity = 0;
        }

        // Update DOM directly for GPU acceleration
        multiplierEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
        multiplierEl.style.opacity = `${opacity}`;
      });
    },
    [config]
  );

  const getGlowIntensityHandler = useCallback(
    (index) => {
      if (!glowIntensityHandlersRef.current[index]) {
        glowIntensityHandlersRef.current[index] = (intensities) => {
          // Apply glow directly to DOM immediately (bypasses React state)
          const element = betspotRefsStorage.current[index];
          if (element) {
            applyGlowToElement(element, intensities);
          }

          // Also queue for state update (for tracking purposes)
          glowIntensityUpdateQueueRef.current.set(index, intensities);

          // Batch state updates - flush every 16ms (roughly 60fps)
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
    [flushGlowIntensityUpdates, applyGlowToElement]
  );

  const handlePlayPause = () => {
    const allPlaying = isPlaying.every(
      (playing, index) => !selectedBetspots[index] || playing
    );
    if (allPlaying) {
      // Stop all selected betspots
      setIsPlaying((prev) =>
        prev.map((playing, index) =>
          selectedBetspots[index] ? false : playing
        )
      );
    } else {
      // Start all selected betspots
      setIsPlaying((prev) =>
        prev.map((playing, index) => (selectedBetspots[index] ? true : playing))
      );
    }
  };

  const isAnyPlaying = useMemo(
    () =>
      isPlaying.some((playing, index) => selectedBetspots[index] && playing),
    [isPlaying, selectedBetspots]
  );

  // Reset multiplier animations when animation stops
  useEffect(() => {
    isPlaying.forEach((playing, index) => {
      const shouldAnimate = playing && selectedBetspots[index];
      if (!shouldAnimate) {
        // Reset all multipliers when animation stops
        const multiplierElements = multiplierRefs.current[index];
        if (multiplierElements) {
          multiplierElements.forEach((multiplierEl) => {
            if (multiplierEl) {
              multiplierEl.style.transform = "translate(-50%, -50%) scale(0)";
              multiplierEl.style.opacity = "0";
            }
          });
        }
        // Reset current time
        currentTimeSecRefs.current[index] = 0;
      }
    });
  }, [isPlaying, selectedBetspots]);

  // Cleanup glow intensity update timeout on unmount
  useEffect(() => {
    return () => {
      if (glowIntensityUpdateTimeoutRef.current) {
        cancelAnimationFrame(glowIntensityUpdateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${gridLayout.cols}, 1fr)`,
          gridTemplateRows: `repeat(${gridLayout.rows}, 1fr)`,
          gap: "20px",
        }}
      >
        {Array.from({ length: betspotCount }).map((_, index) => (
          <div
            key={index}
            className="relative flex items-center justify-center"
          >
            <MemoizedBetSpot ref={getAnchorRefCallback(index)} />
            <Chip />
            {/* Render multiple multipliers based on config */}
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
            {anchorEls[index] && (
              <MemoizedGlowAnimationWebGL
                anchorEl={anchorEls[index]}
                config={config}
                isPlaying={isPlaying[index] && selectedBetspots[index]}
                onAnimationComplete={() => handleAnimationComplete(index)}
                onGlowIntensityChange={getGlowIntensityHandler(index)}
                onTimeUpdate={(currentTimeSec) => {
                  currentTimeSecRefs.current[index] = currentTimeSec;
                  updateMultiplierAnimations(index, currentTimeSec);
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
