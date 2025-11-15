"use client";

import { Settings } from "@mui/icons-material";
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
  const [config, setConfig] = useState({
    speed: 2.0,
    glow: 3.0,
    centerRadius: 2.0,
    paths: [
      {
        id: 1,
        type: "diagonal-tr-bl",
        speed: 2.0,
        delay: 0,
        glow: 10.0,
        centerRadius: 12.0,
        enabled: true,
      },
      // {
      //   id: 2,
      //   type: "diagonal-bl-tr",
      //   speed: 4.0,
      //   delay: 0.3,
      //   glow: 10.0,
      //   centerRadius: 12.0,
      //   enabled: true,
      // },
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
      {anchorEl && <GlowAnimation anchorEl={anchorEl} config={config} />}

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
