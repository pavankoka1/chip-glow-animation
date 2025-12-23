"use client";

export default function ConfigModal({
  isOpen,
  onClose,
  config,
  onConfigChange,
}) {
  if (!isOpen) return null;

  const handleChange = (key, value) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white text-xl font-bold">Spark Configuration</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Radii */}
          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              Tail Radius: {config.tailRadius.toFixed(2)}px
            </label>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={config.tailRadius}
              onChange={(e) =>
                handleChange("tailRadius", parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              Head Radius: {config.headRadius.toFixed(2)}px
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="0.5"
              value={config.headRadius}
              onChange={(e) =>
                handleChange("headRadius", parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              Tip Radius: {config.tipRadius.toFixed(2)}px
            </label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={config.tipRadius}
              onChange={(e) =>
                handleChange("tipRadius", parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              Tip Width: {config.tipWidth.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.tipWidth}
              onChange={(e) =>
                handleChange("tipWidth", parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              White Tip Radius:{" "}
              {config.whiteTipRadius?.toFixed(2) ??
                config.tipRadius?.toFixed(2) ??
                "0.50"}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.whiteTipRadius ?? config.tipRadius ?? 0.5}
              onChange={(e) =>
                handleChange("whiteTipRadius", parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              Yellow Tip Radius:{" "}
              {config.yellowTipRadius?.toFixed(2) ??
                config.tipRadius?.toFixed(2) ??
                "0.50"}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.yellowTipRadius ?? config.tipRadius ?? 0.5}
              onChange={(e) =>
                handleChange("yellowTipRadius", parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>

          {/* White & Yellow */}
          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              White Radius Ratio: {config.whiteRadiusRatio.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.01"
              value={config.whiteRadiusRatio}
              onChange={(e) =>
                handleChange("whiteRadiusRatio", parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              White Cone Height Extension:{" "}
              {(config.whiteConeHeightExtension ?? 0).toFixed(3)}
            </label>
            <input
              type="range"
              min="0"
              max="0.1"
              step="0.001"
              value={config.whiteConeHeightExtension ?? 0}
              onChange={(e) =>
                handleChange(
                  "whiteConeHeightExtension",
                  parseFloat(e.target.value)
                )
              }
              className="w-full"
            />
            <p className="text-xs text-gray-400 mt-1">
              Extends white cone body forward to close gap (0.0 to 0.1)
            </p>
          </div>

          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              Yellow Radius Ratio: {config.yellowRadiusRatio.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.01"
              value={config.yellowRadiusRatio}
              onChange={(e) =>
                handleChange("yellowRadiusRatio", parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              White Hemisphere Base Ratio:{" "}
              {config.whiteHemisphereBaseRatio !== null &&
              config.whiteHemisphereBaseRatio !== undefined
                ? config.whiteHemisphereBaseRatio.toFixed(3)
                : "auto (" + config.whiteRadiusRatio.toFixed(2) + ")"}
            </label>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.01"
              value={
                config.whiteHemisphereBaseRatio !== null &&
                config.whiteHemisphereBaseRatio !== undefined
                  ? config.whiteHemisphereBaseRatio
                  : config.whiteRadiusRatio
              }
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                // If value equals whiteRadiusRatio, set to null (use default)
                handleChange(
                  "whiteHemisphereBaseRatio",
                  value === config.whiteRadiusRatio ? null : value
                );
              }}
              className="w-full"
            />
            <button
              onClick={() => handleChange("whiteHemisphereBaseRatio", null)}
              className="mt-2 text-xs text-gray-400 hover:text-white"
            >
              Reset to auto
            </button>
          </div>

          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              Yellow Hemisphere Base Ratio:{" "}
              {config.yellowHemisphereBaseRatio !== null &&
              config.yellowHemisphereBaseRatio !== undefined
                ? config.yellowHemisphereBaseRatio.toFixed(3)
                : "auto (" +
                  (config.whiteRadiusRatio + config.yellowRadiusRatio).toFixed(
                    2
                  ) +
                  ")"}
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.01"
              value={
                config.yellowHemisphereBaseRatio !== null &&
                config.yellowHemisphereBaseRatio !== undefined
                  ? config.yellowHemisphereBaseRatio
                  : config.whiteRadiusRatio + config.yellowRadiusRatio
              }
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                const defaultVal =
                  config.whiteRadiusRatio + config.yellowRadiusRatio;
                // If value equals default, set to null (use default)
                handleChange(
                  "yellowHemisphereBaseRatio",
                  value === defaultVal ? null : value
                );
              }}
              className="w-full"
            />
            <button
              onClick={() => handleChange("yellowHemisphereBaseRatio", null)}
              className="mt-2 text-xs text-gray-400 hover:text-white"
            >
              Reset to auto
            </button>
          </div>

          {/* Glow */}
          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              Glow Radius: {config.glowRadius.toFixed(2)}px
            </label>
            <input
              type="range"
              min="0"
              max="30"
              step="0.5"
              value={config.glowRadius}
              onChange={(e) =>
                handleChange("glowRadius", parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              Glow Spread: {config.glowSpread.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={config.glowSpread}
              onChange={(e) =>
                handleChange("glowSpread", parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">Glow Color</label>
            <input
              type="color"
              value={config.glowColor}
              onChange={(e) => handleChange("glowColor", e.target.value)}
              className="w-full h-8"
            />
          </div>

          {/* Rotation */}
          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              Rotate X: {config.rotateX.toFixed(1)}°
            </label>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={config.rotateX}
              onChange={(e) =>
                handleChange("rotateX", parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              Rotate Y: {config.rotateY.toFixed(1)}°
            </label>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={config.rotateY}
              onChange={(e) =>
                handleChange("rotateY", parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>

          <div className="bg-black/50 rounded p-3 border border-white/10">
            <label className="block text-white text-sm mb-2">
              Rotate Z: {config.rotateZ.toFixed(1)}°
            </label>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={config.rotateZ}
              onChange={(e) =>
                handleChange("rotateZ", parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
