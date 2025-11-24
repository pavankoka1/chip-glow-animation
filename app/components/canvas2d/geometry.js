import { getAngleForVertex } from "./utils";

export function getVertexCoords(vertexId, rect) {
  if (!rect) {
    const fallback = {
      TL: [-50, 50],
      TR: [50, 50],
      BR: [50, -50],
      BL: [-50, -50],
      T: [0, 50],
      B: [0, -50],
      L: [-50, 0],
      R: [50, 0],
    };
    return fallback[vertexId] || [50, -50];
  }

  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;

  const coords = {
    TL: [-halfWidth, halfHeight],
    TR: [halfWidth, halfHeight],
    BR: [halfWidth, -halfHeight],
    BL: [-halfWidth, -halfHeight],
    T: [0, halfHeight],
    B: [0, -halfHeight],
    L: [-halfWidth, 0],
    R: [halfWidth, 0],
  };

  return coords[vertexId] || [halfWidth, -halfHeight];
}

export function getEllipsePosition2D(
  theta,
  a,
  b,
  rotAngle,
  centerX,
  centerY,
  ellipseTiltDeg = 0,
  ellipseRotationDeg = 0
) {
  const x_local = a * Math.cos(theta);
  const y_local = b * Math.sin(theta);

  const rotExtra = (ellipseRotationDeg * Math.PI) / 180;
  const baseRot = rotAngle + rotExtra;
  const c = Math.cos(baseRot);
  const s = Math.sin(baseRot);
  const x_rot = c * x_local - s * y_local;
  const y_rot = s * x_local + c * y_local;

  let x = x_rot;
  let y = y_rot;

  if (Math.abs(ellipseTiltDeg) > 0.001) {
    const ellipseTiltRad = ((90 - ellipseTiltDeg) * Math.PI) / 180;
    const ct = Math.cos(ellipseTiltRad);
    const oneMinusCt = 1 - ct;

    const majorAxis = [c, s];
    const axisLen = Math.hypot(majorAxis[0], majorAxis[1]);

    if (axisLen > 0.0001) {
      const normalizedAxis = [majorAxis[0] / axisLen, majorAxis[1] / axisLen];

      const m00 = ct + normalizedAxis[0] * normalizedAxis[0] * oneMinusCt;
      const m01 = normalizedAxis[0] * normalizedAxis[1] * oneMinusCt;
      const m10 = normalizedAxis[1] * normalizedAxis[0] * oneMinusCt;
      const m11 = ct + normalizedAxis[1] * normalizedAxis[1] * oneMinusCt;

      const x_tilt = m00 * x_rot + m01 * y_rot;
      const y_tilt = m10 * x_rot + m11 * y_rot;

      x = x_tilt;
      y = y_tilt;

      const tiltOffsetAmount = (ellipseTiltDeg / 90.0) * b * 0.3;
      const perpendicularDir = [-normalizedAxis[1], normalizedAxis[0]];
      x += perpendicularDir[0] * tiltOffsetAmount;
      y += perpendicularDir[1] * tiltOffsetAmount;
    }
  }

  return [x + centerX, y + centerY];
}

export function isPointInsideBetSpot(x, y, centerX, centerY, rect) {
  if (!rect) {
    const halfWidth = 50;
    const halfHeight = 50;
    return (
      x >= centerX - halfWidth &&
      x <= centerX + halfWidth &&
      y >= centerY - halfHeight &&
      y <= centerY + halfHeight
    );
  }

  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;

  return (
    x >= centerX - halfWidth &&
    x <= centerX + halfWidth &&
    y >= centerY - halfHeight &&
    y <= centerY + halfHeight
  );
}

export function calculateAutoA(rect, offset = 0) {
  if (rect) {
    const diagonal = Math.hypot(rect.width, rect.height);
    return offset + diagonal / 2;
  }
  return offset === 0 ? 141.4214 : offset + 141.4214;
}

export function getDynamicRotAngle(startVertex) {
  return startVertex === "BR" || startVertex === "TL"
    ? (135 * Math.PI) / 180
    : (45 * Math.PI) / 180;
}

export function calculateDirection(startVertex, endVertex, configDirection) {
  if (configDirection === "anticlockwise") return -1;
  if (configDirection === "clockwise") return 1;

  const startDir = getAngleForVertex(startVertex);
  const endDir = getAngleForVertex(endVertex);
  const delta = normalizeDelta(endDir - startDir);
  return Math.sign(delta) || 1;
}

function normalizeDelta(angle) {
  let a = angle;
  const twoPi = Math.PI * 2;
  a = ((((a + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
  return a;
}

