"use client";

import { PlayArrow, Settings, Stop } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import BetSpot from "../components/BetSpot";
import Chip from "../components/Chip";
import ConfigModal from "../components/ConfigModal";
import GlowAnimation2D from "../components/GlowAnimation2D";

export default function Canvas2DPage() {
  const betspotRef = useRef(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [config, setConfig] = useState({
    animationTimeMs: 1200,
    // animationTimeMs: 10000,
    glowRadius: 2,
    ellipse: { b: 20, a: 76 },
    headRadius: 3,
    tailRadius: 0.5,
    length: 100,
    sparkColor: "#ffff00",
    glowColor: "#fff391",
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
        animationTimeMs: 800,
        startVertex: "BR",
        circleRadius: 25,
        delay: 1150,
        enabled: true,
        fadeOut: 400,
      },
      {
        id: 4,
        type: "circle",
        animationTimeMs: 800,
        startVertex: "BL",
        circleRadius: 25,
        delay: 1250,
        direction: "anticlockwise", // Go anticlockwise
        enabled: true,
        fadeOut: 400,
      },
      {
        id: 5,
        type: "line",
        animationTimeMs: 1000,
        startPoint: 315, // Start point in radians (360 = full round, 0=top, 90=right, 180=bottom, 270=left)
        lineWidth: 2, // Line stroke width in px (supports decimals)
        coverage: 720, // Coverage in radians (360 = full round)
        glowRadius: 0, // Disable glow for thinner line appearance
        delay: 1000,
        direction: "clockwise", // clockwise or anticlockwise
        sparkColor: "#ffff00", // Line color (defaults to sparkColor)
        enabled: true,
        fadeOut: 400,
      },
      {
        id: 6,
        type: "line",
        animationTimeMs: 1000,
        startPoint: 135, // Start point in radians (360 = full round, 0=top, 90=right, 180=bottom, 270=left)
        lineWidth: 2, // Line stroke width in px (supports decimals)
        coverage: 720, // Coverage in radians (360 = full round)
        glowRadius: 0, // Disable glow for thinner line appearance
        delay: 1000,
        direction: "clockwise", // clockwise or anticlockwise
        sparkColor: "#ffff00", // Line color (defaults to sparkColor)
        enabled: true,
        fadeOut: 400,
      },
    ],
  });

  useEffect(() => {
    if (betspotRef.current) {
      setAnchorEl(betspotRef.current);
    }
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black">
      <div className="relative flex items-center justify-center">
        <BetSpot ref={betspotRef} />
        <Chip />
      </div>
      {anchorEl && (
        <GlowAnimation2D
          anchorEl={anchorEl}
          config={config}
          isPlaying={isPlaying}
          onAnimationComplete={() => setIsPlaying(false)}
        />
      )}
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
    </div>
  );
}
