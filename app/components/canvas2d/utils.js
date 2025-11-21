// Utility functions for 2D canvas animation
// Reused from animation/utils.js but simplified for 2D

export function getAngleForVertex(vertexId) {
  // Map labels to screen-space angles (y increases downward):
  // Right = 0, Down = +π/2, Left = π, Up = -π/2
  // Corners:
  // TL (-1, top) => angle = -3π/4
  // TR (+1, top) => angle = -π/4
  // BR (+1, bottom) => angle = +π/4
  // BL (-1, bottom) => angle = +3π/4
  switch (vertexId) {
    case "TL":
      return -3 * Math.PI / 4;
    case "TR":
      return -Math.PI / 4;
    case "BR":
      return Math.PI / 4;
    case "BL":
      return 3 * Math.PI / 4;
    default:
      return -Math.PI / 4; // default to TR-ish
  }
}

export function resolveNumber(value, fallback) {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

export function resolveEllipse(ellipse, fallback) {
  const a = resolveNumber(ellipse?.a, fallback?.a);
  const b = resolveNumber(ellipse?.b, fallback?.b);
  return { a, b };
}

export function degToRad(d) {
  return (d * Math.PI) / 180;
}

export function delayToSeconds(v) {
  if (typeof v !== "number" || isNaN(v)) return 0;
  return v > 20 ? v / 1000 : v; // treat large values as ms
}

export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return [255, 255, 255]; // Default to white
  }
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

export function normalizeDelta(angle) {
  let a = angle;
  const twoPi = Math.PI * 2;
  a = ((((a + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI; // wrap to (-PI, PI]
  return a;
}

