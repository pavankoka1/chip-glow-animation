// Animation system constants and enums
export const VERTEX_LABELS = [
  { id: "TL", label: "(-1, 1)", angle: Math.PI * 3 / 4 },   // 135°
  { id: "TR", label: "(1, 1)", angle: Math.PI / 4 },        // 45°
  { id: "BR", label: "(1, -1)", angle: -Math.PI / 4 },      // -45°
  { id: "BL", label: "(-1, -1)", angle: Math.PI * 5 / 4 },  // 225°
];

export const DEFAULT_CONFIG = {
  animationTimeMs: 800,
  glowRadius: 30,
  ellipse: { b: 20 }, // a will be auto-calculated as diagonal / 2, b is semi-minor in px
  headRadius: 10,      // radius at head (px)
  tailRadius: 2,       // radius at tail (px)
  length: 80,
  sparkColor: "#ffff00", // default spark color
  glowColor: "#fff391",  // default glow color
  // Internal/advanced settings (not in config modal)
  cameraDistance: 4000,
  viewTiltXDeg: 0,
  viewTiltYDeg: 0,
  depthAmplitude: 0,
  depthPhaseDeg: 0,
  ellipseTiltDeg: 0,
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
    },
  ],
};

export const CAMERA_DISTANCE = 4000.0;


