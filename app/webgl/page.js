"use client";

import { PlayArrow, PlaylistPlay, Settings, Stop } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BetSpot from "../components/BetSpot";
import BetSpotSelectorModal from "../components/BetSpotSelectorModal";
import Chip from "../components/Chip";
import ConfigModal from "../components/ConfigModal";
import GlowAnimationWebGL from "../components/webgl/GlowAnimationWebGL";

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
  const [selectedBetspots, setSelectedBetspots] = useState(() =>
    Array(betspotCount).fill(true)
  );
  const [isPlaying, setIsPlaying] = useState(() =>
    Array(betspotCount).fill(false)
  );
  const [glowIntensities, setGlowIntensities] = useState(() =>
    Array(betspotCount).fill({
      chipGlowIntensity: 0,
      perimeterGlowIntensity: 0,
      glowScale: 1.0,
    })
  );

  // Update arrays when betspot count changes
  const prevBetspotCountRef = useRef(betspotCount);
  useEffect(() => {
    if (prevBetspotCountRef.current === betspotCount) return;
    prevBetspotCountRef.current = betspotCount;

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

  const getGlowIntensityHandler = useCallback((index) => {
    if (!glowIntensityHandlersRef.current[index]) {
      glowIntensityHandlersRef.current[index] = (intensities) => {
        setGlowIntensities((prev) => {
          const current = prev[index];
          // Only update if values actually changed (with threshold to avoid floating point issues)
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
            const newIntensities = [...prev];
            newIntensities[index] = intensities;
            return newIntensities;
          }
          return prev; // Return previous if no change
        });
      };
    }
    return glowIntensityHandlersRef.current[index];
  }, []);

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

  const isAnyPlaying = isPlaying.some(
    (playing, index) => selectedBetspots[index] && playing
  );

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
            <BetSpot
              ref={(el) => {
                betspotRefsStorage.current[index] = el;
                if (el && anchorEls[index] !== el) {
                  setAnchorEls((prev) => {
                    const newEls = [...prev];
                    newEls[index] = el;
                    return newEls;
                  });
                }
              }}
              chipGlowIntensity={glowIntensities[index]?.chipGlowIntensity || 0}
              perimeterGlowIntensity={
                glowIntensities[index]?.perimeterGlowIntensity || 0
              }
              glowScale={glowIntensities[index]?.glowScale || 1.0}
            />
            <Chip />
            {anchorEls[index] && (
              <GlowAnimationWebGL
                anchorEl={anchorEls[index]}
                config={config}
                isPlaying={isPlaying[index] && selectedBetspots[index]}
                onAnimationComplete={() => handleAnimationComplete(index)}
                onGlowIntensityChange={getGlowIntensityHandler(index)}
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
