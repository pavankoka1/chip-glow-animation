"use client";

import { PlayArrow, Stop } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BetSpot from "./components/BetSpot";
import BetSpotAnimations from "./components/BetSpotAnimations/BetSpotAnimations";
import Chip from "./components/Chip";
import { SharedWebGLProvider } from "./components/SharedWebGLContext";
import { DEFAULT_CONFIG } from "./constants/defaultConfig";

export default function WebGLLayersPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const betspotRef = useRef(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [config] = useState(DEFAULT_CONFIG);

  const handleBetspotRef = useCallback((el) => {
    betspotRef.current = el;
    setAnchorEl(el);
  }, []);

  // Example: To use multiple anchorEls with delays, pass anchorEls prop instead of anchorEl:
  // anchorEls={[
  //   { element: anchorEl1, delay: 0 },      // First betspot: no delay
  //   { element: anchorEl2, delay: 500 },      // Second betspot: 500ms delay
  //   { element: anchorEl3, delay: 1000 },    // Third betspot: 1000ms delay
  // ]}

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Calculate total animation duration from all enabled paths
  const totalAnimationDurationMs = useMemo(() => {
    if (!config.paths) return 0;

    return Math.max(
      ...config.paths
        .filter((p) => p.enabled !== false)
        .map((p) => {
          const delay = p.delay || 0;
          let duration = 0;

          // Handle different animation types
          if (p.type === "black-hole") {
            // Black hole uses phase1TimeMs + phase2TimeMs
            duration = (p.phase1TimeMs || 280) + (p.phase2TimeMs || 50);
          } else {
            // All other types use animationTimeMs
            duration = p.animationTimeMs || 0;
          }

          return delay + duration;
        }),
      0
    );
  }, [config]);

  // Auto-stop animation when complete
  useEffect(() => {
    if (!isPlaying || totalAnimationDurationMs === 0) return;

    const timeoutId = setTimeout(() => {
      setIsPlaying(false);
    }, totalAnimationDurationMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isPlaying, totalAnimationDurationMs]);

  return (
    <SharedWebGLProvider>
      <div className="flex min-h-screen w-full items-center justify-center bg-black overflow-hidden relative">
        {/* Betspot in center */}
        <div
          className="relative flex items-center justify-center"
          style={{ overflow: "visible" }}
        >
          <BetSpot ref={handleBetspotRef} />
          <Chip />
          {/* All animations controlled by BetSpotAnimations component */}
          <BetSpotAnimations
            anchorEl={anchorEl}
            config={config}
            isPlaying={isPlaying}
          />
        </div>

        {/* Play Button at Top Left */}
        <IconButton
          onClick={handlePlayPause}
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
          title={isPlaying ? "Stop Animation" : "Play Animation"}
        >
          {isPlaying ? (
            <Stop />
          ) : (
            <PlayArrow sx={{ transform: "translateX(2px)" }} />
          )}
        </IconButton>
      </div>
    </SharedWebGLProvider>
  );
}
