import { VERTEX_LABELS } from "./constants";

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
    default: {
      const found = VERTEX_LABELS.find((v) => v.id === vertexId);
      if (found && typeof found.angle === "number") return found.angle;
      return -Math.PI / 4; // default to TR-ish
    }
  }
}

export function resolveNumber(value, fallback) {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

export function resolveEllipse(ellipse, fallback) {
  const a = resolveNumber(ellipse?.a, fallback.a);
  const b = resolveNumber(ellipse?.b, fallback.b);
  return { a, b };
}

export function nowSeconds() {
  return performance.now() / 1000.0;
}

export function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}


