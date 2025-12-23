"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Dynamically import ConeViewer with SSR disabled since it uses WebGL
const ConeViewer = dynamic(() => import("../components/astroid/ConeViewer"), {
  ssr: false,
});

export default function AstroidPage() {
  const [scale, setScale] = useState(20);
  const [isClient, setIsClient] = useState(false);

  // Use current radius & specifications from spark config
  const baseRadius = 7.0; // headRadius from spark config
  const height = 74.0; // pathLength from spark config
  const whiteRadiusRatio = 0.6; // From sparkConfig
  const yellowRadiusRatio = 0.4; // From sparkConfig

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
        <ConeViewer
          scale={scale}
          baseRadius={baseRadius}
          height={height}
          whiteRadiusRatio={whiteRadiusRatio}
          yellowRadiusRatio={yellowRadiusRatio}
        />

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
      </div>
    </div>
  );
}
