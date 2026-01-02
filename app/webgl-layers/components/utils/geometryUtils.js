/**
 * Get angle for vertex in screen space (y increases downward)
 */
export function getAngleForVertex(vertexId) {
  switch (vertexId) {
    case "TL":
      return (-3 * Math.PI) / 4;
    case "TR":
      return -Math.PI / 4;
    case "BR":
      return Math.PI / 4;
    case "BL":
      return (3 * Math.PI) / 4;
    case "L":
      return Math.PI;
    case "R":
      return 0;
    case "T":
      return -Math.PI / 2;
    case "B":
      return Math.PI / 2;
    default:
      return -Math.PI / 4;
  }
}

/**
 * Get angle for vertex from rectangle coordinates
 */
export function getAngleForVertexFromRect(vertexId, rect) {
  if (!rect) {
    return getAngleForVertex(vertexId);
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

  const [x, y] = coords[vertexId] || [halfWidth, -halfHeight];
  const angle = Math.atan2(-y, x);
  return angle;
}

/**
 * Calculate ellipse position in 2D
 */
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

/**
 * Calculate auto 'a' value from rectangle diagonal
 */
export function calculateAutoA(rect, offset = 0) {
  if (rect) {
    const diagonal = Math.hypot(rect.width, rect.height);
    return offset + diagonal / 2;
  }
  return offset === 0 ? 141.4214 : offset + 141.4214;
}

/**
 * Normalize angle delta to (-PI, PI]
 */
export function normalizeDelta(angle) {
  let a = angle;
  const twoPi = Math.PI * 2;
  a = ((((a + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
  return a;
}

/**
 * Find where the ellipse intersects with BetSpot on the return journey
 * Returns the theta value where the ellipse enters the BetSpot rectangle
 */
export function findEllipseBetSpotIntersection(
  a,
  b,
  rotAngle,
  centerX,
  centerY,
  ellipseTiltDeg,
  thetaStart,
  thetaEnd,
  rect,
  ellipseRotationDeg = 0
) {
  if (!rect) {
    return thetaEnd + 2 * Math.PI;
  }

  const directionSign = Math.sign(thetaEnd) || 1;
  const SAMPLE_STEP = 0.005 * directionSign;
  const MAX_THETA = thetaEnd + directionSign * 2 * Math.PI;
  const SAMPLES = Math.ceil(Math.abs((MAX_THETA - thetaEnd) / SAMPLE_STEP));

  let consecutiveOutside = 0;
  let confirmedOutside = false;
  let lastWasInside = true;
  let intersectionTheta = null;
  const OUTSIDE_THRESHOLD = 3;

  for (let i = 1; i <= SAMPLES; i++) {
    const theta = thetaEnd + i * SAMPLE_STEP;
    const [px, py] = getEllipsePosition2D(
      theta,
      a,
      b,
      rotAngle,
      centerX,
      centerY,
      ellipseTiltDeg,
      ellipseRotationDeg
    );

    const isInside = isPointInsideBetSpot(px, py, centerX, centerY, rect);

    if (!isInside) {
      consecutiveOutside++;
      if (consecutiveOutside >= OUTSIDE_THRESHOLD && !confirmedOutside) {
        confirmedOutside = true;
        lastWasInside = false;
        continue;
      }
    } else {
      consecutiveOutside = 0;
    }

    if (confirmedOutside) {
      if (!lastWasInside && isInside) {
        intersectionTheta = theta;
        break;
      }
    }

    lastWasInside = isInside;
  }

  return intersectionTheta !== null
    ? intersectionTheta
    : thetaEnd + directionSign * 2 * Math.PI;
}

/**
 * Check if a point is inside the BetSpot rectangle
 */
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
