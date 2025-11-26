"use client";

import { PlayArrow, PlaylistPlay, Settings, Stop } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { useMemo, useRef, useState } from "react";
import BetSpot from "../components/BetSpot";
import BetSpotSelectorModal from "../components/BetSpotSelectorModal";
import Chip from "../components/Chip";
import ConfigModal from "../components/ConfigModal";
import GlowAnimationWebGL from "../components/webgl/GlowAnimationWebGL";

const BETSPOT_COUNT = 5;

export default function WebGLPage() {
  const betspotRef0 = useRef(null);
  const betspotRef1 = useRef(null);
  const betspotRef2 = useRef(null);
  const betspotRef3 = useRef(null);
  const betspotRef4 = useRef(null);
  const betspotRefs = useMemo(
    () => [betspotRef0, betspotRef1, betspotRef2, betspotRef3, betspotRef4],
    []
  );
  const [anchorEls, setAnchorEls] = useState(Array(BETSPOT_COUNT).fill(null));
  const [configOpen, setConfigOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedBetspots, setSelectedBetspots] = useState(
    Array(BETSPOT_COUNT).fill(true)
  );
  const [isPlaying, setIsPlaying] = useState(Array(BETSPOT_COUNT).fill(false));
  const [config, setConfig] = useState({
    animationTimeMs: 1200,
    glowRadius: 5,
    ellipse: { b: 20, a: 76 },
    headRadius: 3,
    tailRadius: 1,
    length: 100,
    sparkColor: "#f1eb9d",
    glowColor: "#fdcb3d",
    paths: [
      {
        id: 1,
        type: "spark",
        startVertex: "BR",
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
        delay: 400,
        ellipseTiltDeg: 45,
        ellipseRotationDeg: 2,
        enabled: true,
      },
      {
        id: 3,
        type: "circle",
        animationTimeMs: 1200,
        startVertex: "BR",
        circleRadius: 25,
        delay: 650,
        enabled: true,
        fadeOut: 400,
      },
      {
        id: 4,
        type: "circle",
        animationTimeMs: 1200,
        startVertex: "BL",
        circleRadius: 25,
        delay: 750,
        direction: "anticlockwise",
        enabled: true,
        fadeOut: 400,
      },
      {
        id: 5,
        type: "line",
        animationTimeMs: 1000,
        startPoint: 315,
        lineWidth: 4,
        iterations: 1,
        glowRadius: 0,
        delay: 1000,
        direction: "clockwise",
        sparkColor: "#fdcb3d",
        enabled: true,
        fadeOut: 400,
      },
      {
        id: 6,
        type: "line",
        animationTimeMs: 1000,
        startPoint: 135,
        lineWidth: 4,
        iterations: 1,
        glowRadius: 0,
        delay: 1000,
        direction: "clockwise",
        sparkColor: "#fdcb3d",
        enabled: true,
        fadeOut: 400,
      },
    ],
  });

  const handleSelectionChange = (selection) => {
    setSelectedBetspots(selection);
    // Reset playing state based on selection
    const newPlaying = Array(BETSPOT_COUNT).fill(false);
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
      <div className="grid grid-cols-5 gap-8">
        {Array.from({ length: BETSPOT_COUNT }).map((_, index) => (
          <div
            key={index}
            className="relative flex items-center justify-center"
          >
            <BetSpot
              ref={(el) => {
                betspotRefs[index].current = el;
                if (el && anchorEls[index] !== el) {
                  setAnchorEls((prev) => {
                    const newEls = [...prev];
                    newEls[index] = el;
                    return newEls;
                  });
                }
              }}
            />
            <Chip />
            {anchorEls[index] && (
              <GlowAnimationWebGL
                anchorEl={anchorEls[index]}
                config={config}
                isPlaying={isPlaying[index] && selectedBetspots[index]}
                onAnimationComplete={() => handleAnimationComplete(index)}
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
        betspotCount={BETSPOT_COUNT}
        selectedBetspots={selectedBetspots}
        onSelectionChange={handleSelectionChange}
      />
    </div>
  );
}
