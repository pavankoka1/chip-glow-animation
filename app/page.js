"use client";

import { PlayArrow, Settings, Stop } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import BetSpot from "./components/BetSpot";
import Chip from "./components/Chip";
import ConfigModal from "./components/ConfigModal";
import GlowAnimation from "./components/GlowAnimation";

export default function Home() {
  const betspotRef = useRef(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [config, setConfig] = useState({
    animationTimeMs: 700,
    glowRadius: 30,
    ellipse: { b: 10 }, // a will be auto-calculated as 10 + (diagonal / 2)
    centerRadius: 10,
    endRadius: 5,
    length: 300,
    // Camera / depth / tilt defaults
    cameraDistance: 2000,
    viewTiltXDeg: 0,
    viewTiltYDeg: 0,
    depthAmplitude: 100,
    depthPhaseDeg: 0,
    paths: [
      {
        id: 1,
        startVertex: "BR",
        endVertex: "TL",
        delay: 0,
        length: 100,
        enabled: true,
      },
      {
        id: 2,
        startVertex: "BL",
        endVertex: "TR",
        delay: 300,
        length: 100,
        enabled: true,
      },
      {
        id: 3,
        startVertex: "BR",
        endVertex: "TL",
        delay: 900,
        length: 100,
        enabled: true,
      },
      {
        id: 4,
        startVertex: "BL",
        endVertex: "TR",
        delay: 1200,
        length: 100,
        enabled: true,
      },
    ],
  });

  useEffect(() => {
    if (betspotRef.current) {
      setAnchorEl(betspotRef.current);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="relative">
        <BetSpot ref={betspotRef} />
        <Chip />
      </div>
      {anchorEl && (
        <GlowAnimation
          anchorEl={anchorEl}
          config={config}
          isPlaying={isPlaying}
          onAnimationComplete={() => setIsPlaying(false)}
        />
      )}

      {/* Play Button */}
      <IconButton
        onClick={() => setIsPlaying(!isPlaying)}
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

      {/* Config Toggle Button */}
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

      {/* Config Modal */}
      <ConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        config={config}
        onConfigChange={setConfig}
      />
    </div>
  );
}
