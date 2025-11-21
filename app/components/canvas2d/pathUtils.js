import {
  delayToSeconds,
  getAngleForVertex,
  hexToRgb,
  normalizeDelta,
  resolveEllipse,
  resolveNumber,
} from "./utils";

// Helper to get vertex coordinates in mathematical coordinates (Y+ up)
// Returns [x, y] relative to center
function getVertexCoords(vertexId, rect) {
  if (!rect) {
    // Fallback: assume 200px betspot
    const fallback = {
      TL: [-50, 50], // Top-Left: negative X, positive Y (math coords)
      TR: [50, 50], // Top-Right: positive X, positive Y
      BR: [50, -50], // Bottom-Right: positive X, negative Y
      BL: [-50, -50], // Bottom-Left: negative X, negative Y
      T: [0, 50], // Top center
      B: [0, -50], // Bottom center
      L: [-50, 0], // Left center
      R: [50, 0], // Right center
    };
    return fallback[vertexId] || [50, -50]; // Default to BR
  }

  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;

  // In mathematical coordinates (Y+ up):
  // TL: (-halfWidth, halfHeight)
  // TR: (halfWidth, halfHeight)
  // BR: (halfWidth, -halfHeight)
  // BL: (-halfWidth, -halfHeight)
  // T: (0, halfHeight) - Top center
  // B: (0, -halfHeight) - Bottom center
  // L: (-halfWidth, 0) - Left center
  // R: (halfWidth, 0) - Right center
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

  return coords[vertexId] || [halfWidth, -halfHeight]; // Default to BR
}

// Compute 2D ellipse position (simplified from 3D version)
function getEllipsePosition2D(
  theta,
  a,
  b,
  rotAngle,
  centerX,
  centerY,
  ellipseTiltDeg = 0,
  ellipseRotationDeg = 0
) {
  // Local ellipse coordinates
  const x_local = a * Math.cos(theta);
  const y_local = b * Math.sin(theta);

  // Apply rotation (same as WebGL: baseRot = rotAngle + rotExtra)
  const rotExtra = (ellipseRotationDeg * Math.PI) / 180;
  const baseRot = rotAngle + rotExtra;
  const c = Math.cos(baseRot);
  const s = Math.sin(baseRot);
  const x_rot = c * x_local - s * y_local;
  const y_rot = s * x_local + c * y_local;

  // Apply ellipse tilt - 2D version of 3D rotation around major axis
  let x = x_rot;
  let y = y_rot;

  if (Math.abs(ellipseTiltDeg) > 0.001) {
    // Calculate ellipse tilt angle (same as WebGL: (90 - ellipseTiltDeg) * PI / 180)
    const ellipseTiltRad = ((90 - ellipseTiltDeg) * Math.PI) / 180;
    const ct = Math.cos(ellipseTiltRad);
    const st = Math.sin(ellipseTiltRad);
    const oneMinusCt = 1 - ct;

    // Major axis direction (normalized)
    const majorAxis = [c, s];
    const axisLen = Math.hypot(majorAxis[0], majorAxis[1]);

    if (axisLen > 0.0001) {
      const normalizedAxis = [majorAxis[0] / axisLen, majorAxis[1] / axisLen];

      // 2D rotation matrix around major axis
      // In 2D, we rotate in the plane perpendicular to the major axis
      // This is equivalent to rotating around the z-axis by the tilt angle
      // and then projecting back to 2D
      const m00 = ct + normalizedAxis[0] * normalizedAxis[0] * oneMinusCt;
      const m01 = normalizedAxis[0] * normalizedAxis[1] * oneMinusCt;
      const m10 = normalizedAxis[1] * normalizedAxis[0] * oneMinusCt;
      const m11 = ct + normalizedAxis[1] * normalizedAxis[1] * oneMinusCt;

      // Apply rotation matrix
      const x_tilt = m00 * x_rot + m01 * y_rot;
      const y_tilt = m10 * x_rot + m11 * y_rot;

      x = x_tilt;
      y = y_tilt;

      // Apply tilt offset (same as WebGL)
      const tiltOffsetAmount = (ellipseTiltDeg / 90.0) * b * 0.3;
      const perpendicularDir = [-normalizedAxis[1], normalizedAxis[0]];
      x += perpendicularDir[0] * tiltOffsetAmount;
      y += perpendicularDir[1] * tiltOffsetAmount;
    }
  }

  // Translate to center
  return [x + centerX, y + centerY];
}

// Check if a point is inside the BetSpot rectangle
function isPointInsideBetSpot(x, y, centerX, centerY, rect) {
  if (!rect) {
    // Fallback: assume 100x100 betspot
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

// Find where the ellipse intersects with BetSpot on the return journey
// Returns the theta value where the ellipse enters the BetSpot rectangle
function findEllipseBetSpotIntersection(
  a,
  b,
  rotAngle,
  centerX,
  centerY,
  ellipseTiltDeg,
  thetaStart,
  thetaEnd,
  rect,
  startVertex,
  ellipseRotationDeg = 0
) {
  if (!rect) {
    // Fallback: go one full rotation if no rect
    return thetaEnd + 2 * Math.PI;
  }

  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;

  // Sample points along the ellipse starting from thetaEnd, going around
  // We need to find when the ellipse re-enters the BetSpot rectangle
  // Handle both positive and negative thetaEnd (clockwise vs anticlockwise)
  const directionSign = Math.sign(thetaEnd) || 1; // Use sign of thetaEnd to determine direction
  const SAMPLE_STEP = 0.005 * directionSign; // Fine sampling for accurate intersection, respect direction
  const MAX_THETA = thetaEnd + directionSign * 2 * Math.PI;
  const SAMPLES = Math.ceil(Math.abs((MAX_THETA - thetaEnd) / SAMPLE_STEP));

  // Sample points along the ellipse starting from thetaEnd
  // We need to: 1) confirm we go outside, 2) find when we re-enter

  let consecutiveOutside = 0;
  const OUTSIDE_THRESHOLD = 10; // Need 10 consecutive outside points to confirm we're outside
  let confirmedOutside = false;
  let lastWasInside = true; // Start assuming we're inside (at the end vertex)
  let intersectionTheta = null;

  for (let i = 1; i <= SAMPLES; i++) {
    const theta = thetaEnd + i * SAMPLE_STEP; // SAMPLE_STEP already has the correct sign
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

    // Track consecutive outside points to confirm we've left the BetSpot
    if (!isInside) {
      consecutiveOutside++;
      if (consecutiveOutside >= OUTSIDE_THRESHOLD && !confirmedOutside) {
        confirmedOutside = true;
        lastWasInside = false; // We're now confirmed to be outside
        continue;
      }
    } else {
      consecutiveOutside = 0;
    }

    // Once we've confirmed we're outside, look for re-entry
    if (confirmedOutside) {
      // If we transition from outside to inside, that's our intersection point
      // (the spark is returning and hitting the BetSpot)
      if (!lastWasInside && isInside) {
        intersectionTheta = theta;
        break;
      }
    }

    lastWasInside = isInside;
  }

  // If we didn't find an intersection, default to going one full rotation in the same direction
  // directionSign is already defined above
  return intersectionTheta !== null
    ? intersectionTheta
    : thetaEnd + directionSign * 2 * Math.PI;
}

// Compute path length for spark (elliptical arc)
// Now includes the return journey until it hits the BetSpot
export function computeSparkPathLength2D(
  a,
  b,
  rotAngle,
  thetaStart,
  thetaEnd,
  centerX,
  centerY,
  ellipseTiltDeg = 0,
  rect = null,
  startVertex = null,
  ellipseRotationDeg = 0
) {
  // Find where the ellipse intersects with BetSpot on return
  const actualThetaEnd = findEllipseBetSpotIntersection(
    a,
    b,
    rotAngle,
    centerX,
    centerY,
    ellipseTiltDeg,
    thetaStart,
    thetaEnd,
    rect,
    startVertex,
    ellipseRotationDeg
  );

  const SAMPLES = 256; // Increased samples for longer path
  let [px0, py0] = getEllipsePosition2D(
    thetaStart,
    a,
    b,
    rotAngle,
    centerX,
    centerY,
    ellipseTiltDeg,
    ellipseRotationDeg
  );
  let total = 0;

  // Interpolate from thetaStart to actualThetaEnd
  // Don't normalize theta - let the ellipse function handle periodicity naturally
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const th = thetaStart + (actualThetaEnd - thetaStart) * t;

    const [px, py] = getEllipsePosition2D(
      th,
      a,
      b,
      rotAngle,
      centerX,
      centerY,
      ellipseTiltDeg,
      ellipseRotationDeg
    );
    total += Math.hypot(px - px0, py - py0);
    px0 = px;
    py0 = py;
  }

  return { pathLength: total, actualThetaEnd };
}

// Compute path length for line path (traveling around BetSpot border)
export function computeLinePathLength2D(
  centerX,
  centerY,
  rect = null,
  startPoint = 0, // Start point in radians (360 = full round)
  direction = "clockwise"
) {
  if (!rect) {
    // Fallback: assume 200x200 betspot
    const fallbackPerimeter = 2 * (200 + 200); // 2 * (width + height)
    return {
      pathLength: fallbackPerimeter,
      startPoint,
      direction,
      halfWidth: 100,
      halfHeight: 100,
    };
  }

  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;

  // Perimeter of rectangle: 2 * (width + height)
  const perimeter = 2 * (rect.width + rect.height);

  return {
    pathLength: perimeter,
    startPoint,
    direction,
    halfWidth,
    halfHeight,
  };
}

// Get position along line path (traveling around border)
// startPointRad: starting position in radians (360 = full round)
// Returns position at distance along perimeter
function getLinePathPositionByDistance(
  distance, // Absolute distance along perimeter (0 to perimeter)
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  startPointRad, // Starting position offset in radians (360 = full round), if 0 then distance is absolute
  direction = "clockwise"
) {
  // Defensive checks for invalid inputs
  const safeHalfWidth = halfWidth || 50;
  const safeHalfHeight = halfHeight || 50;

  const width = safeHalfWidth * 2;
  const height = safeHalfHeight * 2;
  const perimeter = 2 * (width + height);

  // If perimeter is 0 or invalid, return center
  if (perimeter <= 0 || !isFinite(perimeter)) {
    return { x: centerX, y: centerY, angle: 0 };
  }

  // If startPointRad is provided, add it as an offset
  let adjustedDistance = distance;
  if (startPointRad !== 0) {
    const startPointFraction = (((startPointRad % 360) + 360) % 360) / 360.0;
    const startDistance = startPointFraction * perimeter;
    adjustedDistance = (startDistance + distance) % perimeter;
  }

  // Normalize to [0, perimeter)
  adjustedDistance =
    adjustedDistance < 0 ? adjustedDistance + perimeter : adjustedDistance;
  adjustedDistance = adjustedDistance % perimeter;

  const isClockwise = direction !== "anticlockwise";

  // Define edges in clockwise order
  const corners = {
    TL: [-safeHalfWidth, safeHalfHeight],
    TR: [safeHalfWidth, safeHalfHeight],
    BR: [safeHalfWidth, -safeHalfHeight],
    BL: [-safeHalfWidth, -safeHalfHeight],
  };

  const edges = [
    { from: "TL", to: "TR", length: width, angle: 0 }, // Top: right
    { from: "TR", to: "BR", length: height, angle: Math.PI / 2 }, // Right: down
    { from: "BR", to: "BL", length: width, angle: Math.PI }, // Bottom: left
    { from: "BL", to: "TL", length: height, angle: -Math.PI / 2 }, // Left: up
  ];

  // Always use the same edge order [0,1,2,3] to find which edge contains a given distance
  // This ensures consistent distance mapping regardless of direction
  // The direction only affects how we traverse along each edge (from 'from' to 'to' or vice versa)
  const edgeOrder = [0, 1, 2, 3]; // Always check edges in clockwise order for distance mapping

  // Find which edge we're on and position within that edge
  let remainingDist = adjustedDistance;
  let currentEdgeIdx = 0;
  let edgeCount = 0;

  // Handle the case where remainingDist is exactly 0
  while (remainingDist >= 0 && edgeCount < 4) {
    const edgeIdx = edgeOrder[currentEdgeIdx % 4];
    const edge = edges[edgeIdx];

    if (!edge) {
      // Safety check: if edge is undefined, break
      break;
    }

    const [fromX, fromY] = corners[edge.from];
    const [toX, toY] = corners[edge.to];
    const edgeLen = edge.length;

    if (remainingDist <= edgeLen) {
      // We're on this edge
      const tOnEdge = edgeLen > 0 ? remainingDist / edgeLen : 0;

      // For clockwise: travel from 'from' to 'to' along the edge
      // For anticlockwise: travel from 'to' to 'from' along the edge (reverse direction)
      let startX, startY, endX, endY;
      if (isClockwise) {
        startX = fromX;
        startY = fromY;
        endX = toX;
        endY = toY;
      } else {
        // Anticlockwise: reverse the edge direction
        startX = toX;
        startY = toY;
        endX = fromX;
        endY = fromY;
      }

      // Interpolate along the edge
      const x = startX + (endX - startX) * tOnEdge;
      const y = startY + (endY - startY) * tOnEdge;

      let angle = edge.angle;
      if (!isClockwise) angle += Math.PI;

      // Convert to screen coordinates
      const screenX = x + centerX;
      const screenY = -y + centerY;

      return { x: screenX, y: screenY, angle };
    }

    remainingDist -= edgeLen;
    currentEdgeIdx++;
    edgeCount++;
  }

  // Fallback to end of path - handle edge case where we might not have found an edge
  // Handle negative modulo properly: (currentEdgeIdx - 1 + 4) % 4 ensures we get a valid index
  const fallbackEdgeIdx = (currentEdgeIdx - 1 + 4) % 4;
  const lastEdgeIdx =
    fallbackEdgeIdx >= 0 && fallbackEdgeIdx < edgeOrder.length
      ? edgeOrder[fallbackEdgeIdx]
      : undefined;

  if (
    lastEdgeIdx !== undefined &&
    lastEdgeIdx >= 0 &&
    lastEdgeIdx < edges.length
  ) {
    const lastEdge = edges[lastEdgeIdx];
    if (lastEdge && lastEdge.from && lastEdge.to) {
      const cornerKey = isClockwise ? lastEdge.to : lastEdge.from;
      const corner = corners[cornerKey];
      if (corner && Array.isArray(corner) && corner.length >= 2) {
        const [endX, endY] = corner;
        return { x: endX + centerX, y: -endY + centerY, angle: 0 };
      }
    }
  }

  // Ultimate fallback: return center position
  return { x: centerX, y: centerY, angle: 0 };
}

// Legacy function for backward compatibility - converts t to distance
function getLinePathPosition(
  t, // 0 to 1
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  startPointRad, // Starting position in radians (360 = full round)
  direction = "clockwise"
) {
  const width = halfWidth * 2;
  const height = halfHeight * 2;
  const perimeter = 2 * (width + height);
  const distance = Math.max(0, Math.min(1, t)) * perimeter;
  return getLinePathPositionByDistance(
    distance,
    centerX,
    centerY,
    halfWidth,
    halfHeight,
    startPointRad,
    direction
  );
}

// Compute path length for circle path (ellipse to circle transition)
export function computeCirclePathLength2D(
  a,
  b,
  rotAngle,
  centerX,
  centerY,
  circleRadius,
  rect = null,
  startVertex = "BR",
  direction = "clockwise" // "clockwise", "anticlockwise", or "auto"
) {
  const SAMPLES = 128;

  // Get start vertex coordinates
  const [startVertexX, startVertexY] = getVertexCoords(startVertex, rect);

  // Helper to get ellipse position in math coords (Y+ up)
  const getEllipsePosMath = (theta) => {
    const x_local = a * Math.cos(theta);
    const y_local = b * Math.sin(theta);
    const c = Math.cos(rotAngle);
    const s = Math.sin(rotAngle);
    const x_math = c * x_local - s * y_local;
    const y_math = s * x_local + c * y_local;
    return [x_math, y_math];
  };

  // Helper to get ellipse position in screen coords
  const getEllipsePos = (theta) => {
    const [x_math, y_math] = getEllipsePosMath(theta);
    const x = x_math + centerX;
    const y = -y_math + centerY; // Flip Y for screen coords
    return [x, y];
  };

  // Find theta on ellipse that corresponds to start vertex
  const findThetaFromPoint = (targetX, targetY, initialGuess = 0) => {
    const guesses = [
      initialGuess,
      initialGuess + Math.PI,
      initialGuess + Math.PI / 2,
      initialGuess - Math.PI / 2,
    ];
    let bestTheta = initialGuess;
    let bestError = Infinity;

    for (const guess of guesses) {
      let theta = guess;
      const tolerance = 0.05;
      const maxIterations = 50;

      while (theta < 0) theta += 2 * Math.PI;
      while (theta >= 2 * Math.PI) theta -= 2 * Math.PI;

      for (let iter = 0; iter < maxIterations; iter++) {
        const [x, y] = getEllipsePosMath(theta);
        const dx = x - targetX;
        const dy = y - targetY;
        const error = Math.hypot(dx, dy);

        if (error < tolerance) {
          if (error < bestError) {
            bestError = error;
            bestTheta = theta;
          }
          break;
        }

        const dtheta = 0.001;
        const [x1, y1] = getEllipsePosMath(theta + dtheta);
        const dx_dtheta = (x1 - x) / dtheta;
        const dy_dtheta = (y1 - y) / dtheta;
        const gradient = dx * dx_dtheta + dy * dy_dtheta;
        const hessian = dx_dtheta * dx_dtheta + dy_dtheta * dy_dtheta;

        if (Math.abs(hessian) > 0.0001) {
          const step = gradient / hessian;
          theta -= step * 0.5;
        } else {
          theta += error > 10 ? 0.1 : 0.01;
        }

        while (theta < 0) theta += 2 * Math.PI;
        while (theta >= 2 * Math.PI) theta -= 2 * Math.PI;

        if (error < bestError) {
          bestError = error;
          bestTheta = theta;
        }
      }
    }

    return bestTheta;
  };

  // Calculate meeting point based on direction
  // For clockwise: 90° clockwise from start vertex (subtract PI/2)
  // For anticlockwise: 90° anticlockwise from start vertex (add PI/2)
  const startAngle = Math.atan2(startVertexY, startVertexX);
  const directionSign = direction === "anticlockwise" ? 1 : -1;
  const meetingAngle = startAngle + (directionSign * Math.PI) / 2;
  const meetingPointX = circleRadius * Math.cos(meetingAngle);
  const meetingPointY = circleRadius * Math.sin(meetingAngle);

  // Find theta on ellipse for meeting point
  let MEETING_THETA = findThetaFromPoint(
    meetingPointX,
    meetingPointY,
    meetingAngle
  );

  // Find theta for start vertex
  const startVertexAngle = Math.atan2(startVertexY, startVertexX);
  let START_THETA = findThetaFromPoint(
    startVertexX,
    startVertexY,
    startVertexAngle
  );

  // Refine if needed
  const [verifyStartX, verifyStartY] = getEllipsePosMath(START_THETA);
  let startError = Math.hypot(
    verifyStartX - startVertexX,
    verifyStartY - startVertexY
  );

  if (startError > 1.0) {
    // Exhaustive search
    let bestTheta = START_THETA;
    let bestError = startError;
    const searchStep = 0.005;

    for (let testTheta = 0; testTheta < 2 * Math.PI; testTheta += searchStep) {
      const [testX, testY] = getEllipsePosMath(testTheta);
      const testError = Math.hypot(testX - startVertexX, testY - startVertexY);
      if (testError < bestError) {
        bestError = testError;
        bestTheta = testTheta;
        if (bestError < 0.1) break;
      }
    }
    START_THETA = bestTheta;
  }

  // Calculate ellipse portion length
  const ellipseSamples = 64;
  let ellipsePathLength = 0;
  let [prevX, prevY] = getEllipsePos(START_THETA);

  for (let i = 1; i <= ellipseSamples; i++) {
    const thetaT = i / ellipseSamples;
    let theta = START_THETA + (MEETING_THETA - START_THETA) * thetaT;
    if (theta < 0) theta += 2 * Math.PI;
    else if (theta >= 2 * Math.PI) theta -= 2 * Math.PI;

    const [x, y] = getEllipsePos(theta);
    ellipsePathLength += Math.hypot(x - prevX, y - prevY);
    prevX = x;
    prevY = y;
  }

  // Circle portion: 2 full rotations
  // Direction affects the rotation direction: clockwise = negative, anticlockwise = positive
  const circleRotations = 2;
  const circlePathLength = circleRotations * 2 * Math.PI * circleRadius;

  const totalPathLength = ellipsePathLength + circlePathLength;
  const ellipsePortion = ellipsePathLength / totalPathLength;
  const circlePortion = circlePathLength / totalPathLength;

  // Calculate meeting circle angle
  const [meetingX_math, meetingY_math] = getEllipsePosMath(MEETING_THETA);
  const meetingCircleAngle = Math.atan2(meetingY_math, meetingX_math);

  return {
    pathLength: totalPathLength,
    startTheta: START_THETA,
    meetingTheta: MEETING_THETA,
    ellipsePortion,
    circlePortion,
    meetingCircleAngle,
    direction, // Include direction in return value
  };
}

// Get position along spark path
function getSparkPathPosition(
  t,
  a,
  b,
  rotAngle,
  thetaStart,
  thetaEnd,
  centerX,
  centerY,
  ellipseTiltDeg = 0,
  ellipseRotationDeg = 0
) {
  // Interpolate from thetaStart to thetaEnd
  // Don't normalize - let the ellipse function handle periodicity through cos/sin
  const theta = thetaStart + (thetaEnd - thetaStart) * t;

  return getEllipsePosition2D(
    theta,
    a,
    b,
    rotAngle,
    centerX,
    centerY,
    ellipseTiltDeg,
    ellipseRotationDeg
  );
}

// Get position along circle path
function getCirclePathPosition(
  t,
  a,
  b,
  rotAngle,
  centerX,
  centerY,
  circleRadius,
  startTheta,
  meetingTheta,
  ellipsePortion,
  circlePortion,
  meetingCircleAngle,
  direction = "clockwise"
) {
  if (t <= ellipsePortion) {
    const ellipseT = t / ellipsePortion;
    let theta = startTheta + (meetingTheta - startTheta) * ellipseT;
    if (theta < 0) theta += 2 * Math.PI;
    else if (theta >= 2 * Math.PI) theta -= 2 * Math.PI;

    const x_local = a * Math.cos(theta);
    const y_local = b * Math.sin(theta);
    const c = Math.cos(rotAngle);
    const s = Math.sin(rotAngle);
    const x_math = c * x_local - s * y_local;
    const y_math = s * x_local + c * y_local;
    const x = x_math + centerX;
    const y = -y_math + centerY;
    return [x, y];
  } else {
    const circleT = (t - ellipsePortion) / circlePortion;
    const circleRotations = 2;
    const totalRotation = circleRotations * 2 * Math.PI;
    // Direction affects rotation: clockwise = negative (decreasing angle), anticlockwise = positive (increasing angle)
    const directionSign = direction === "anticlockwise" ? 1 : -1;
    const angle = meetingCircleAngle + directionSign * totalRotation * circleT;
    const x_math = circleRadius * Math.cos(angle);
    const y_math = circleRadius * Math.sin(angle);
    const x = x_math + centerX;
    const y = -y_math + centerY;
    return [x, y];
  }
}

// Draw a continuous line along the border with smooth corners
// startPointRad: starting position in radians (360 = full round)
// coverageRad: coverage in radians (360 = full round)
// length: line length in px, defaults to betSpot side length
// easedNormalizedTime: 0 to 1, controls line growth from 0 to full length
// directionSign: 1 for anticlockwise, -1 for clockwise (inverted to fix direction issue)
function drawLinePath(
  ctx,
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  startPointRad, // Starting position in radians (360 = full round)
  direction,
  coverageRad, // Coverage in radians (360 = full round)
  length, // Line length in px
  lineWidth,
  color,
  glowRadius,
  glowColor,
  alpha = 1,
  easedNormalizedTime = 1.0, // Animation progress 0 to 1
  directionSign = 1 // 1 for anticlockwise, -1 for clockwise (inverted to fix direction issue)
) {
  const width = halfWidth * 2;
  const height = halfHeight * 2;
  const perimeter = 2 * (width + height);

  // Default length to betSpot side length (average of width and height)
  const defaultLength = (width + height) / 2;
  const targetLineLength =
    length !== undefined && length > 0 ? length : defaultLength;

  // Convert coverage from radians (360 = full round) to distance
  let coverageFraction;
  if (Math.abs(coverageRad) < 0.001) {
    coverageFraction = 0.0;
  } else {
    const coverageMod = Math.abs(coverageRad % 360);
    if (coverageMod < 0.001 || Math.abs(coverageMod - 360) < 0.001) {
      coverageFraction = 1.0;
    } else {
      coverageFraction = (((coverageRad % 360) + 360) % 360) / 360.0;
    }
  }
  const coverageDistance = coverageFraction * perimeter;

  // Two-phase animation:
  // Phase 1: Line grows from 0 to targetLineLength (caterpillar growth)
  // Phase 2: Line of fixed length targetLineLength moves along the perimeter
  //
  // Determine the ratio of time for phase 1 vs phase 2
  // Phase 1 should be relatively short - just enough to grow the line to full length
  // Phase 2 should be the rest - moving the line along the perimeter
  const GROWTH_PHASE_RATIO = 0.25; // 25% of animation time for growth, 75% for movement

  let actualLineLength;
  let lineStartDistance;
  let lineEndDistance;

  if (easedNormalizedTime <= GROWTH_PHASE_RATIO) {
    // Phase 1: Line grows from 0 to targetLineLength
    const growthProgress = easedNormalizedTime / GROWTH_PHASE_RATIO;
    actualLineLength = targetLineLength * growthProgress;

    // Start point stays fixed at startPointRad
    const startPointFraction = (((startPointRad % 360) + 360) % 360) / 360.0;
    lineStartDistance = startPointFraction * perimeter;
    lineEndDistance = lineStartDistance + actualLineLength * directionSign;
  } else {
    // Phase 2: Line of fixed length moves along the perimeter
    actualLineLength = targetLineLength;

    // Movement progress: 0 to 1 over the remaining 75% of animation
    const movementProgress =
      (easedNormalizedTime - GROWTH_PHASE_RATIO) / (1 - GROWTH_PHASE_RATIO);

    // Start point moves along the perimeter based on coverage
    const startPointFraction = (((startPointRad % 360) + 360) % 360) / 360.0;
    const baseStartDistance = startPointFraction * perimeter;

    // Move the line along the perimeter by coverageDistance * movementProgress
    const travelDistance = coverageDistance * movementProgress;
    lineStartDistance = baseStartDistance + travelDistance * directionSign;
    lineEndDistance = lineStartDistance + actualLineLength * directionSign;
  }

  if (actualLineLength <= 0) {
    return;
  }

  // Normalize distances to [0, perimeter)
  const normalizeDistance = (dist) => {
    let normalized = dist % perimeter;
    if (normalized < 0) normalized += perimeter;
    return normalized;
  };

  const actualStartDist = normalizeDistance(lineStartDistance);
  const actualEndDist = normalizeDistance(lineEndDistance);

  // Check if line wraps around based on actual line length
  // For clockwise: if we go past perimeter
  // For anticlockwise: if we go past 0
  const wrapped =
    directionSign > 0
      ? lineEndDistance > perimeter && actualEndDist < actualStartDist
      : lineEndDistance < 0 && actualEndDist > actualStartDist;

  // Special case: if coverage is exactly 360 and the line is actually drawing the full perimeter, we need to wrap
  const isFullRoundCoverage =
    Math.abs(coverageRad % 360) < 0.001 ||
    Math.abs(Math.abs(coverageRad) - 360) < 0.001;
  const shouldForceWrapForFullRound =
    isFullRoundCoverage && Math.abs(actualLineLength - perimeter) < 0.001;

  const finalWrapped = wrapped || shouldForceWrapForFullRound;

  // Sample points along the line segment
  const SAMPLE_COUNT = 150;
  const points = [];

  if (actualLineLength > 0) {
    if (finalWrapped) {
      // Line wraps around the perimeter
      if (directionSign > 0) {
        // Clockwise wrap: start -> perimeter, then 0 -> end
        const firstPartLength = perimeter - actualStartDist;
        // Handle full round case: if actualEndDist == actualStartDist, we want to draw the full perimeter
        // In this case, secondPartLength should be actualStartDist to complete the round
        const secondPartLength =
          Math.abs(actualEndDist - actualStartDist) < 0.001 &&
          Math.abs(actualLineLength - perimeter) < 0.001
            ? actualStartDist // Full round: draw from 0 back to start
            : actualEndDist; // Normal wrap: draw from 0 to end
        const totalLength = firstPartLength + secondPartLength;

        if (totalLength > 0) {
          const firstPartSamples = Math.max(
            1,
            Math.floor(SAMPLE_COUNT * (firstPartLength / totalLength))
          );
          const secondPartSamples = Math.max(
            1,
            Math.floor(SAMPLE_COUNT * (secondPartLength / totalLength))
          );

          // First part: from start to perimeter
          for (let i = 0; i <= firstPartSamples; i++) {
            const t = firstPartSamples > 0 ? i / firstPartSamples : 0;
            const distance = actualStartDist + firstPartLength * t;
            const { x, y } = getLinePathPositionByDistance(
              distance,
              centerX,
              centerY,
              halfWidth,
              halfHeight,
              0,
              direction
            );
            points.push({ x, y });
          }

          // Second part: from 0 to end
          for (let i = 0; i <= secondPartSamples; i++) {
            const t = secondPartSamples > 0 ? i / secondPartSamples : 0;
            const distance = secondPartLength * t;
            const { x, y } = getLinePathPositionByDistance(
              distance,
              centerX,
              centerY,
              halfWidth,
              halfHeight,
              0,
              direction
            );
            points.push({ x, y });
          }
        }
      } else {
        // Anticlockwise wrap: start -> 0, then perimeter -> end
        const firstPartLength = actualStartDist;
        // Handle full round case: if actualEndDist == actualStartDist, we want to draw the full perimeter
        // In this case, secondPartLength should be perimeter - actualStartDist to complete the round
        const secondPartLength =
          Math.abs(actualEndDist - actualStartDist) < 0.001 &&
          Math.abs(actualLineLength - perimeter) < 0.001
            ? perimeter - actualStartDist // Full round: draw from perimeter back to start
            : perimeter - actualEndDist; // Normal wrap: draw from perimeter to end
        const totalLength = firstPartLength + secondPartLength;

        if (totalLength > 0) {
          const firstPartSamples = Math.max(
            1,
            Math.floor(SAMPLE_COUNT * (firstPartLength / totalLength))
          );
          const secondPartSamples = Math.max(
            1,
            Math.floor(SAMPLE_COUNT * (secondPartLength / totalLength))
          );

          // First part: from start to 0 (going backwards)
          for (let i = 0; i <= firstPartSamples; i++) {
            const t = firstPartSamples > 0 ? i / firstPartSamples : 0;
            const distance = actualStartDist - firstPartLength * t;
            const normalizedDist = normalizeDistance(distance);
            const { x, y } = getLinePathPositionByDistance(
              normalizedDist,
              centerX,
              centerY,
              halfWidth,
              halfHeight,
              0,
              direction
            );
            points.push({ x, y });
          }

          // Second part: from perimeter to end (going backwards)
          for (let i = 0; i <= secondPartSamples; i++) {
            const t = secondPartSamples > 0 ? i / secondPartSamples : 0;
            const distance = perimeter - secondPartLength * t;
            const normalizedDist = normalizeDistance(distance);
            const { x, y } = getLinePathPositionByDistance(
              normalizedDist,
              centerX,
              centerY,
              halfWidth,
              halfHeight,
              0,
              direction
            );
            points.push({ x, y });
          }
        }
      }
    } else {
      // Normal case: line doesn't wrap
      // Draw from lineStartDistance to lineEndDistance
      // Sample points along the line segment of length actualLineLength
      for (let i = 0; i <= SAMPLE_COUNT; i++) {
        const t = SAMPLE_COUNT > 0 ? i / SAMPLE_COUNT : 0;
        // Distance along the line from start
        const distanceAlongLine = actualLineLength * t;
        // Start from lineStartDistance and move in the direction
        const distance = lineStartDistance + distanceAlongLine * directionSign;
        const normalizedDist = normalizeDistance(distance);
        const { x, y } = getLinePathPositionByDistance(
          normalizedDist,
          centerX,
          centerY,
          halfWidth,
          halfHeight,
          0,
          direction
        );
        points.push({ x, y });
      }
    }
  }

  if (points.length < 2) {
    return;
  }

  // Ensure lineWidth is a number and supports decimals
  // This ensures the exact value is preserved, including decimal values
  // Convert to number if it's a string, allow 0 as valid value
  let processedLineWidth = lineWidth;
  if (typeof lineWidth === "string") {
    processedLineWidth = parseFloat(lineWidth);
  }

  // Must be > 0 to be visible, default to 1 if invalid
  const finalLineWidth =
    typeof processedLineWidth === "number" &&
    !Number.isNaN(processedLineWidth) &&
    processedLineWidth > 0
      ? processedLineWidth
      : 1;

  const [r, g, b] = hexToRgb(color);
  const [gr, gg, gb] = hexToRgb(glowColor);

  ctx.save();

  // Draw glow first (behind the line) if glowRadius > 0
  if (glowRadius > 0) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    // Draw smooth continuous path - lineJoin="round" will handle smooth corners
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.strokeStyle = `rgba(${gr}, ${gg}, ${gb}, ${0.95 * alpha})`;
    ctx.lineWidth = finalLineWidth + glowRadius * 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round"; // This creates smooth bending at corners
    ctx.stroke();
  }

  // Draw the main line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  // Draw smooth continuous path
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  ctx.lineWidth = finalLineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round"; // This creates smooth bending at corners
  ctx.stroke();

  ctx.restore();
}

// Draw a single point with glow effect
function drawGlowPoint(
  ctx,
  x,
  y,
  radius,
  glowRadius,
  sparkColor,
  glowColor,
  alpha = 1
) {
  const [r, g, b] = hexToRgb(sparkColor);
  const [gr, gg, gb] = hexToRgb(glowColor);

  // Always draw the core object (spark) with sparkColor
  // This is the actual spark, defined by headRadius and tailRadius
  // The core should always be visible regardless of glowRadius
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();

  // If glowRadius > 0, draw the aura/glow effect around the object
  // Create a beautiful, ethereal aura that emanates from the spark like natural light
  // The aura should feel special - smooth, radiant, with natural light falloff
  if (glowRadius > 0) {
    const totalRadius = radius + glowRadius;
    const coreRatio = radius / totalRadius;

    // Create radial gradient starting from center for true aura effect
    // This makes the glow feel like light radiating from the spark itself
    const gradient = ctx.createRadialGradient(
      x,
      y,
      0, // Start from absolute center for natural light emanation
      x,
      y,
      totalRadius // End at the aura edge
    );

    // Create a special, ethereal aura with natural light falloff
    // Use exponential decay for realistic light behavior - feels like real light emanating
    const maxAuraAlpha = 0.95 * alpha; // Strong, vibrant aura

    // Generate many color stops for ultra-smooth, ethereal gradient
    // More stops = smoother transition = more special, professional look
    const numStops = 16; // Even more stops for silky smooth aura

    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops; // 0 to 1

      // Exponential falloff with power 2.8 for natural light decay
      // This creates a smooth, ethereal fade that feels like real light radiating
      // Power 2.8 gives a nice balance - not too sharp, not too gradual
      const falloff = Math.pow(1 - t, 2.8);
      let auraAlpha = maxAuraAlpha * falloff;

      // Ensure smooth, continuous fade without harsh transitions
      // Maintain high intensity near center for that special "glowing" feel
      gradient.addColorStop(t, `rgba(${gr}, ${gg}, ${gb}, ${auraAlpha})`);
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, totalRadius, 0, 2 * Math.PI);
    ctx.fill();
  }
}

// Main drawing function
export function drawPath2D({
  ctx,
  canvas,
  anchorCenter,
  timeNowSec,
  globalConfig,
  pathConfig,
  easedNormalizedTime,
  totalArcPx,
  metrics,
  isCirclePath,
  isLinePath = false, // Line path flag
  anchorEl,
  elapsed = 0, // Elapsed time since delay in seconds
  durationSec = 1, // Animation duration in seconds
}) {
  const merged = {
    animationTimeMs: resolveNumber(
      pathConfig.animationTimeMs,
      globalConfig.animationTimeMs
    ),
    glowRadius: resolveNumber(pathConfig.glowRadius, globalConfig.glowRadius),
    headRadius: resolveNumber(
      pathConfig.headRadius,
      globalConfig.headRadius ?? 10
    ),
    tailRadius: resolveNumber(
      pathConfig.tailRadius,
      globalConfig.tailRadius ?? 2
    ),
    length: resolveNumber(pathConfig.length, globalConfig.length), // Spark length for segmentParam
    delay: resolveNumber(pathConfig.delay, 0),
    ellipse: resolveEllipse(pathConfig.ellipse, globalConfig.ellipse),
    overshoot: resolveNumber(
      pathConfig.overshoot,
      globalConfig.overshoot ?? 0.08
    ),
    fadeWindow: resolveNumber(
      pathConfig.fadeWindow,
      globalConfig.fadeWindow ?? 0.08
    ),
    sparkColor: pathConfig.sparkColor ?? globalConfig.sparkColor ?? "#ffffe0",
    glowColor: pathConfig.glowColor ?? globalConfig.glowColor ?? "#fffba4",
    ellipseTiltDeg: resolveNumber(
      pathConfig.ellipseTiltDeg,
      globalConfig.ellipseTiltDeg ?? 0
    ),
    ellipseRotationDeg: resolveNumber(
      pathConfig.ellipseRotationDeg,
      globalConfig.ellipseRotationDeg ?? 0
    ),
    direction: pathConfig.direction ?? globalConfig.direction ?? "auto", // "clockwise", "anticlockwise", or "auto"
    fadeIn: resolveNumber(pathConfig.fadeIn, globalConfig.fadeIn ?? 0), // fadeIn duration in ms
    fadeOut: resolveNumber(pathConfig.fadeOut, globalConfig.fadeOut ?? 0), // fadeOut duration in ms
    // Line width (stroke width) in px, supports decimals
    // Prioritize path-specific lineWidth, then global, then default to 1
    // Support both number and string inputs, convert to number
    lineWidth: (() => {
      let pathValue = pathConfig.lineWidth;
      let globalValue = globalConfig.lineWidth;

      // Convert to number if it's a string
      if (typeof pathValue === "string") {
        pathValue = parseFloat(pathValue);
      }
      if (typeof globalValue === "string") {
        globalValue = parseFloat(globalValue);
      }

      // Check if pathValue is explicitly set and is a valid number
      // Must be > 0 to be visible
      if (
        typeof pathValue === "number" &&
        !Number.isNaN(pathValue) &&
        pathValue > 0
      ) {
        return pathValue;
      }
      // Fall back to global value if it's a valid number
      if (
        typeof globalValue === "number" &&
        !Number.isNaN(globalValue) &&
        globalValue > 0
      ) {
        return globalValue;
      }
      // Default to 1 if neither is set
      return 1;
    })(),
    coverage: resolveNumber(pathConfig.coverage, globalConfig.coverage ?? 360), // Coverage in radians (360 = full round)
    // For line paths, only use length if explicitly set on the path itself
    // Don't inherit global length for line paths to avoid conflicts with coverage
    // Check if pathConfig.length is explicitly set (not undefined) and is a valid number > 0
    lineLength:
      pathConfig.length !== undefined &&
      typeof pathConfig.length === "number" &&
      pathConfig.length > 0
        ? pathConfig.length
        : undefined, // Line length in px (separate from spark length), defaults to betSpot side length if undefined
    startPoint: resolveNumber(
      pathConfig.startPoint,
      globalConfig.startPoint ?? 0
    ), // Start point in radians (360 = full round)
  };

  // Use isLinePath from parameter, fallback to checking type
  const isLinePathFlag =
    isLinePath !== undefined ? isLinePath : pathConfig.type === "line";

  const delaySec = delayToSeconds(merged.delay);
  const adjustedTime = timeNowSec - delaySec;
  if (adjustedTime < 0) return;

  // Calculate fadeIn and fadeOut alpha
  let fadeInAlpha = 1.0;
  let fadeOutAlpha = 1.0;

  // FadeIn: fade from 0 to 1 over fadeIn duration
  // If fadeIn is 200ms, fade from 0 to 1 in 200ms from the start
  if (merged.fadeIn > 0) {
    const fadeInSec = merged.fadeIn / 1000.0; // Convert ms to seconds
    const fadeInProgress = Math.min(1.0, Math.max(0.0, elapsed / fadeInSec));
    fadeInAlpha = fadeInProgress;
  }

  // FadeOut: fade from 1 to 0 over fadeOut duration
  // If fadeOut is 200ms, fade from 1 to 0 in the last 200ms
  if (merged.fadeOut > 0) {
    const fadeOutSec = merged.fadeOut / 1000.0; // Convert ms to seconds
    const timeUntilEnd = durationSec - elapsed;
    const fadeOutProgress = Math.min(
      1.0,
      Math.max(0.0, timeUntilEnd / fadeOutSec)
    );
    fadeOutAlpha = fadeOutProgress;
  }

  // For line paths, use simpler phase calculation
  // Line paths don't use segmentParam the same way as spark/circle
  const totalArcPxVal = Math.max(totalArcPx || 1.0, 0.0001);
  const segmentParam = isLinePathFlag
    ? 0 // Line paths don't use segmentParam
    : Math.min(merged.length / totalArcPxVal, 1.0);
  const totalSpan = isLinePathFlag
    ? 1.0 // Line paths just go from 0 to 1
    : 1.0 + segmentParam + merged.overshoot;
  const phase = easedNormalizedTime * totalSpan;

  const maxPhase = totalSpan;

  // For line paths, don't apply the early return based on fadeWindow
  // Let the line animate for the full duration
  if (!isLinePathFlag && phase >= maxPhase + merged.fadeWindow - 0.0001) return;

  const segHead = Math.min(Math.max(phase, 0), totalSpan);
  const segTail = Math.min(Math.max(phase - segmentParam, 0), 1.0);

  if (!isLinePathFlag && segTail >= 1.0 - 0.0001) {
    const pastEnd = phase - 1.0;
    if (pastEnd >= merged.fadeWindow) return;
  }

  // Calculate alpha fade
  let alpha = 1.0;

  // Apply existing fadeWindow-based fade (for end of animation)
  // Only apply if fadeOut is not explicitly set, to avoid conflicts
  // Skip fadeWindow for line paths - they use fadeOut instead
  if (merged.fadeOut <= 0 && !isLinePathFlag) {
    if (phase > maxPhase) {
      const fadeMul =
        1.0 -
        Math.min((phase - maxPhase) / Math.max(merged.fadeWindow, 0.0001), 1.0);
      alpha *= fadeMul;
    } else if (segTail >= 1.0 - 0.0001) {
      const pastEnd = Math.max(0.0, phase - 1.0);
      const fadeOutPhase = Math.min(
        pastEnd / Math.max(merged.fadeWindow, 0.0001),
        1.0
      );
      alpha *= 1.0 - fadeOutPhase;
    }
  }

  // Apply fadeIn and fadeOut
  alpha *= fadeInAlpha * fadeOutAlpha;

  if (alpha <= 0) {
    return;
  }

  const [centerX, centerY] = anchorCenter;

  // Sample points along the path segment
  const SAMPLE_COUNT = 50;
  const points = [];

  // Handle line path separately - draw as single continuous line
  if (isLinePathFlag) {
    // Line path: travel around BetSpot border as single continuous line
    const halfWidth =
      metrics?.halfWidth ??
      (anchorEl?.getBoundingClientRect
        ? anchorEl.getBoundingClientRect().width / 2
        : 50);
    const halfHeight =
      metrics?.halfHeight ??
      (anchorEl?.getBoundingClientRect
        ? anchorEl.getBoundingClientRect().height / 2
        : 50);

    const baseStartPointRad = merged.startPoint; // Base start point in radians (360 = full round)
    const coverageRad = merged.coverage; // Coverage in radians (360 = full round)
    const length = merged.lineLength; // Line length in px (separate from spark length)
    const direction =
      merged.direction === "anticlockwise" ? "anticlockwise" : "clockwise";

    // Animate the line to travel around the border
    // The line should:
    // 1. Start at baseStartPointRad
    // 2. Start with length 0
    // 3. Grow in the direction of travel
    // 4. Grow to full length based on easedNormalizedTime

    // Direction: controls the visual direction of the line animation
    // getLinePathPositionByDistance always uses edgeOrder [0,1,2,3] for consistent distance mapping
    // The direction only affects how we traverse along each edge (from 'from' to 'to' or 'to' to 'from')
    // directionSign controls the direction of line growth and movement along the perimeter
    // For anticlockwise: directionSign = -1 to decrease distance (go backwards along perimeter)
    // For clockwise: directionSign = 1 to increase distance (go forward along perimeter)
    const directionSign = direction === "anticlockwise" ? -1 : 1;

    // The start point stays fixed
    const animatedStartPointRad = baseStartPointRad;

    // The line length should grow from 0 to target length based on easedNormalizedTime
    // Pass easedNormalizedTime to drawLinePath so it can grow the line
    drawLinePath(
      ctx,
      centerX,
      centerY,
      halfWidth,
      halfHeight,
      animatedStartPointRad,
      direction,
      coverageRad,
      length,
      merged.lineWidth,
      merged.sparkColor,
      merged.glowRadius,
      merged.glowColor,
      alpha,
      easedNormalizedTime, // Pass easedNormalizedTime for line growth
      directionSign // Pass directionSign for correct growth direction
    );

    // Return early - line is drawn separately
    return;
  } else if (isCirclePath) {
    const circleRadius = pathConfig.circleRadius ?? 30;
    const a = merged.ellipse.a;
    const b = merged.ellipse.b;
    const rotAngle = metrics?.rotAngle ?? (135 * Math.PI) / 180;

    // Fade out the last 40% of points to make the end subtle and eliminate the dot
    const FADE_OUT_RATIO = 0.4; // Last 40% of the path
    const fadeStartIndex = Math.floor(SAMPLE_COUNT * (1 - FADE_OUT_RATIO));
    // Skip the last several points entirely to ensure no visible dot
    const SKIP_LAST_POINTS = 12;

    for (let i = 0; i <= SAMPLE_COUNT - SKIP_LAST_POINTS; i++) {
      const t = segTail + (segHead - segTail) * (i / SAMPLE_COUNT);
      const tClamped = Math.max(0, Math.min(1, t));

      const [x, y] = getCirclePathPosition(
        tClamped,
        a,
        b,
        rotAngle,
        centerX,
        centerY,
        circleRadius,
        metrics?.startTheta ?? 0,
        metrics?.meetingTheta ?? 0,
        metrics?.ellipsePortion ?? 0.5,
        metrics?.circlePortion ?? 0.5,
        metrics?.meetingCircleAngle ?? 0,
        merged.direction ?? "clockwise"
      );

      const along01 = i / SAMPLE_COUNT;
      let radius =
        merged.tailRadius + (merged.headRadius - merged.tailRadius) * along01;

      // Apply aggressive fade-out to the last portion to eliminate the dot
      let pointAlpha = alpha;
      let shouldAdd = true;

      if (i >= fadeStartIndex) {
        const fadeProgress =
          (i - fadeStartIndex) /
          (SAMPLE_COUNT - SKIP_LAST_POINTS - fadeStartIndex);
        // Extremely aggressive fade using very steep ease-out curve (power of 5 for extremely fast fade)
        const fadeAlpha = Math.max(0, 1 - Math.pow(fadeProgress, 5));
        pointAlpha = alpha * fadeAlpha;
        // Aggressively reduce radius to near zero for the last points
        // Reduce radius more aggressively to eliminate any visible dot
        radius = radius * Math.max(0, 0.02 + 0.98 * fadeAlpha);

        // Only add point in fade region if it has meaningful visibility
        // Use very strict threshold to ensure no visible dot remains
        // Require both high alpha and reasonable radius to prevent any dot from showing
        shouldAdd = pointAlpha > 0.1 && radius > 0.5;
      }

      // Add point if it should be visible
      if (shouldAdd) {
        points.push({ x, y, radius, along01, alpha: pointAlpha });
      }
    }
  } else {
    const startDir = getAngleForVertex(pathConfig.startVertex);
    const endDir = getAngleForVertex(pathConfig.endVertex);
    let delta = normalizeDelta(endDir - startDir);
    let dir = Math.sign(delta) || 1;
    const thetaStartLocal = 0.0;
    // Use thetaEndLocal from metrics if available, respecting direction
    const thetaEndLocal = metrics?.thetaEndLocal ?? Math.abs(delta || Math.PI);
    const rotAngle = startDir;

    const a = merged.ellipse.a;
    const b = merged.ellipse.b;

    // Use actualThetaEnd if available (from intersection calculation), otherwise use thetaEndLocal
    const actualThetaEnd = metrics?.actualThetaEnd ?? thetaEndLocal;

    // Get BetSpot rect for intersection checking
    const rect = anchorEl?.getBoundingClientRect
      ? anchorEl.getBoundingClientRect()
      : null;
    const halfWidth = rect ? rect.width / 2 : 50;
    const halfHeight = rect ? rect.height / 2 : 50;

    // Use thetaEndLocal from metrics if available, otherwise calculate it
    // For the initial path (before return journey), we need the absolute value to calculate the ratio
    // but we should use the signed value for the actual path
    const initialPathEndTheta = Math.abs(
      metrics?.thetaEndLocal ?? thetaEndLocal
    );

    for (let i = 0; i <= SAMPLE_COUNT; i++) {
      const t = segTail + (segHead - segTail) * (i / SAMPLE_COUNT);
      const tClamped = Math.max(0, Math.min(1, t));

      const [x, y] = getSparkPathPosition(
        tClamped,
        a,
        b,
        rotAngle,
        thetaStartLocal,
        actualThetaEnd,
        centerX,
        centerY,
        merged.ellipseTiltDeg,
        merged.ellipseRotationDeg
      );

      // Calculate if we're past the initial path (from startVertex to endVertex)
      // Use the ratio of path lengths to determine this
      // Use absolute values for range calculations to handle both directions
      const totalPathRange = Math.abs(actualThetaEnd - thetaStartLocal);
      const initialPathRange = Math.abs(initialPathEndTheta - thetaStartLocal);
      const initialPathRatio =
        initialPathRange / Math.max(totalPathRange, 0.0001);
      const isPastInitialPath = tClamped > initialPathRatio;

      // If we're past the initial path (return journey) and inside BetSpot, skip this point
      // This prevents the "dot" from appearing at the intersection point
      if (isPastInitialPath) {
        const isInside =
          x >= centerX - halfWidth &&
          x <= centerX + halfWidth &&
          y >= centerY - halfHeight &&
          y <= centerY + halfHeight;
        if (isInside) {
          // Stop drawing once we hit the BetSpot on return
          // Don't add this point or any subsequent points
          break;
        }
      }

      const along01 = i / SAMPLE_COUNT;
      const radius =
        merged.tailRadius + (merged.headRadius - merged.tailRadius) * along01;
      points.push({ x, y, radius, along01 });
    }
  }

  // Draw points with glow (for spark and circle)
  ctx.save();
  for (const point of points) {
    // Use point-specific alpha if available (for circle fade-out), otherwise use global alpha
    const pointAlpha = point.alpha !== undefined ? point.alpha : alpha;
    drawGlowPoint(
      ctx,
      point.x,
      point.y,
      point.radius,
      merged.glowRadius,
      merged.sparkColor,
      merged.glowColor,
      pointAlpha
    );
  }
  ctx.restore();
}
