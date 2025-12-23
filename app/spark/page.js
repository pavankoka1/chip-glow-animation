"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import ConfigModal from "../components/spark/ConfigModal";
import { DEFAULT_CONFIG } from "../webgl/constants/defaultConfig";

// Dynamically import SparkViewer with SSR disabled since it uses WebGL
const SparkViewer = dynamic(() => import("../components/spark/SparkViewer"), {
  ssr: false,
});

// Force a horizontal left-to-right config for the viewer
const SPARK_CONFIG = {
  ...DEFAULT_CONFIG.paths[0],
  startVertex: "L",
  endVertex: "R",
  ellipseTiltDeg: 0,
  ellipseRotationDeg: 0,
};

export default function SparkPage() {
  const [scale, setScale] = useState(20);
  const [isClient, setIsClient] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sparkConfig, setSparkConfig] = useState({
    tailRadius: 0.75,
    headRadius: 7.0,
    tipRadius: 0.5,
    tipWidth: 0.1,
    whiteTipRadius: 0.5,
    yellowTipRadius: 0.5,
    whiteRadiusRatio: 0.6,
    yellowRadiusRatio: 0.4,
    whiteHemisphereBaseRatio: 0.45, // Set to a value (e.g., 0.55) to make white base smaller
    yellowHemisphereBaseRatio: null, // Set to a value to adjust yellow base
    whiteConeHeightExtension: 0.04, // Extension factor for white cone height (0.0 to 1.0)
    glowRadius: 10.0,
    glowSpread: 2.0,
    glowColor: "#FEFE51",
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-black">
        <div className="relative w-full h-screen" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black">
      <div className="relative w-full h-screen">
        <SparkViewer
          config={SPARK_CONFIG}
          globalConfig={DEFAULT_CONFIG}
          scale={scale}
          sparkConfig={sparkConfig}
        />

        {/* Config Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="absolute top-4 right-4 z-20 bg-black/80 hover:bg-black/90 text-white px-4 py-2 rounded-lg border border-white/20 flex items-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
          Config
        </button>

        {/* Scale Slider */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-black/80 rounded-lg p-4 border border-white/20">
            <label className="block text-white text-sm mb-2 text-center">
              Scale: {scale.toFixed(2)}x
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(Number.parseFloat(e.target.value))}
              className="w-64 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            />
          </div>
        </div>

        <ConfigModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          config={sparkConfig}
          onConfigChange={setSparkConfig}
        />
      </div>
    </div>
  );
}
