// Animation system constants and enums
export const VERTEX_LABELS = [
  { id: "TL", label: "(-1, 1)", angle: Math.PI * 3 / 4 },   // 135°
  { id: "TR", label: "(1, 1)", angle: Math.PI / 4 },        // 45°
  { id: "BR", label: "(1, -1)", angle: -Math.PI / 4 },      // -45°
  { id: "BL", label: "(-1, -1)", angle: Math.PI * 5 / 4 },  // 225°
];

export const DEFAULT_CONFIG = {
  animationTimeMs: 1200,
  glowRadius: 20,
  ellipse: { b: 12 }, // a will be auto-calculated as 10 + (diagonal / 2), b is semi-minor in px
  centerRadius: 8,
  endRadius: 0,
  length: 300,
  cameraDistance: 4000,
  viewTiltXDeg: 0,  // camera pitch (deg), rotates around X
  viewTiltYDeg: 0,  // camera yaw (deg), rotates around Y
  depthAmplitude: 0, // default no depth to avoid diagonal deviation
  depthPhaseDeg: 0,    // phase shift (deg) for depth oscillation
  overshoot: 0.08,
  fadeWindow: 0.08,
  debug: false,
  paths: [
    {
      id: 1,
      startVertex: "TR",
      endVertex: "BL",
      delay: 0,
      enabled: true,
      // Optional overrides per-path:
      // animationTimeMs, glowRadius, ellipse: {a,b}, centerRadius, endRadius, length,
      // cameraDistance, viewTiltXDeg, viewTiltYDeg, depthAmplitude, depthPhaseDeg, ellipseRotationDeg,
      // overshoot, fadeWindow, debug
    },
  ],
};

export const CAMERA_DISTANCE = 4000.0;


