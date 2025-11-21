import {
  degToRad,
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
  const coords = {
    TL: [-halfWidth, halfHeight],
    TR: [halfWidth, halfHeight],
    BR: [halfWidth, -halfHeight],
    BL: [-halfWidth, -halfHeight],
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
  ellipseTiltDeg = 0
) {
  // Local ellipse coordinates
  const x_local = a * Math.cos(theta);
  const y_local = b * Math.sin(theta);

  // Apply rotation
  const c = Math.cos(rotAngle);
  const s = Math.sin(rotAngle);
  const x_rot = c * x_local - s * y_local;
  const y_rot = s * x_local + c * y_local;

  // Apply ellipse tilt as a 2D rotation around the major axis
  let x = x_rot;
  let y = y_rot;

  if (Math.abs(ellipseTiltDeg) > 0.001) {
    const tiltOffsetAmount = (ellipseTiltDeg / 90.0) * b * 0.3;

    // Major axis direction
    const majorAxis = [c, s];
    const axisLen = Math.hypot(majorAxis[0], majorAxis[1]);
    if (axisLen > 0.0001) {
      const normalizedAxis = [majorAxis[0] / axisLen, majorAxis[1] / axisLen];
      const perpendicularDir = [-normalizedAxis[1], normalizedAxis[0]];

      // Apply tilt offset
      x += perpendicularDir[0] * tiltOffsetAmount;
      y += perpendicularDir[1] * tiltOffsetAmount;
    }
  }

  // Translate to center
  return [x + centerX, y + centerY];
}

// Compute path length for spark (elliptical arc)
export function computeSparkPathLength2D(
  a,
  b,
  rotAngle,
  thetaStart,
  thetaEnd,
  centerX,
  centerY,
  ellipseTiltDeg = 0
) {
  const SAMPLES = 128;
  let [px0, py0] = getEllipsePosition2D(
    thetaStart,
    a,
    b,
    rotAngle,
    centerX,
    centerY,
    ellipseTiltDeg
  );
  let total = 0;

  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const th = thetaStart + (thetaEnd - thetaStart) * t;
    const [px, py] = getEllipsePosition2D(
      th,
      a,
      b,
      rotAngle,
      centerX,
      centerY,
      ellipseTiltDeg
    );
    total += Math.hypot(px - px0, py - py0);
    px0 = px;
    py0 = py;
  }

  return total;
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
  startVertex = "BR"
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

  // Calculate meeting point - 90° clockwise from start vertex
  const startAngle = Math.atan2(startVertexY, startVertexX);
  const meetingAngle = startAngle - Math.PI / 2;
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
  ellipseTiltDeg = 0
) {
  const theta = thetaStart + (thetaEnd - thetaStart) * t;
  return getEllipsePosition2D(theta, a, b, rotAngle, centerX, centerY, ellipseTiltDeg);
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
  meetingCircleAngle
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
    const angle = meetingCircleAngle - totalRotation * circleT;
    const x_math = circleRadius * Math.cos(angle);
    const y_math = circleRadius * Math.sin(angle);
    const x = x_math + centerX;
    const y = -y_math + centerY;
    return [x, y];
  }
}

// Draw a single point with glow effect
function drawGlowPoint(ctx, x, y, radius, glowRadius, sparkColor, glowColor, alpha = 1) {
  // Create radial gradient for glow
  const gradient = ctx.createRadialGradient(x, y, radius, x, y, radius + glowRadius);
  
  const [r, g, b] = hexToRgb(sparkColor);
  const [gr, gg, gb] = hexToRgb(glowColor);
  
  // Core (spark color)
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
  gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha * 0.8})`);
  // Glow (glow color)
  gradient.addColorStop(0.7, `rgba(${gr}, ${gg}, ${gb}, ${alpha * 0.6})`);
  gradient.addColorStop(1, `rgba(${gr}, ${gg}, ${gb}, 0)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius + glowRadius, 0, 2 * Math.PI);
  ctx.fill();
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
    length: resolveNumber(pathConfig.length, globalConfig.length),
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
  };

  const delaySec = delayToSeconds(merged.delay);
  const adjustedTime = timeNowSec - delaySec;
  if (adjustedTime < 0) return;

  const totalArcPxVal = Math.max(totalArcPx || 1.0, 0.0001);
  const segmentParam = Math.min(merged.length / totalArcPxVal, 1.0);
  const totalSpan = 1.0 + segmentParam + merged.overshoot;
  const phase = easedNormalizedTime * totalSpan;

  const maxPhase = totalSpan;
  if (phase >= maxPhase + merged.fadeWindow - 0.0001) return;

  const segHead = Math.min(Math.max(phase, 0), totalSpan);
  const segTail = Math.min(Math.max(phase - segmentParam, 0), 1.0);

  if (segTail >= 1.0 - 0.0001) {
    const pastEnd = phase - 1.0;
    if (pastEnd >= merged.fadeWindow) return;
  }

  // Calculate alpha fade
  let alpha = 1.0;
  if (phase > maxPhase) {
    const fadeMul = 1.0 - Math.min(
      (phase - maxPhase) / Math.max(merged.fadeWindow, 0.0001),
      1.0
    );
    alpha *= fadeMul;
  } else if (segTail >= 1.0 - 0.0001) {
    const pastEnd = Math.max(0.0, phase - 1.0);
    const fadeOutPhase = Math.min(
      pastEnd / Math.max(merged.fadeWindow, 0.0001),
      1.0
    );
    alpha *= 1.0 - fadeOutPhase;
  }

  if (alpha <= 0) return;

  const [centerX, centerY] = anchorCenter;

  // Sample points along the path segment
  const SAMPLE_COUNT = 50;
  const points = [];

  if (isCirclePath) {
    const circleRadius = pathConfig.circleRadius ?? 30;
    const a = merged.ellipse.a;
    const b = merged.ellipse.b;
    const rotAngle = metrics?.rotAngle ?? (135 * Math.PI) / 180;

    for (let i = 0; i <= SAMPLE_COUNT; i++) {
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
        metrics?.meetingCircleAngle ?? 0
      );

      const along01 = (i / SAMPLE_COUNT);
      const radius = merged.tailRadius + (merged.headRadius - merged.tailRadius) * along01;
      points.push({ x, y, radius, along01 });
    }
  } else {
    const startDir = getAngleForVertex(pathConfig.startVertex);
    const endDir = getAngleForVertex(pathConfig.endVertex);
    let delta = normalizeDelta(endDir - startDir);
    let dir = Math.sign(delta) || 1;
    const thetaStartLocal = 0.0;
    const thetaEndLocal = Math.abs(delta || Math.PI);
    const rotAngle = startDir;

    const a = merged.ellipse.a;
    const b = merged.ellipse.b;

    for (let i = 0; i <= SAMPLE_COUNT; i++) {
      const t = segTail + (segHead - segTail) * (i / SAMPLE_COUNT);
      const tClamped = Math.max(0, Math.min(1, t));
      
      const [x, y] = getSparkPathPosition(
        tClamped,
        a,
        b,
        rotAngle,
        thetaStartLocal,
        thetaEndLocal,
        centerX,
        centerY,
        merged.ellipseTiltDeg
      );

      const along01 = (i / SAMPLE_COUNT);
      const radius = merged.tailRadius + (merged.headRadius - merged.tailRadius) * along01;
      points.push({ x, y, radius, along01 });
    }
  }

  // Draw points with glow
  ctx.save();
  for (const point of points) {
    drawGlowPoint(
      ctx,
      point.x,
      point.y,
      point.radius,
      merged.glowRadius,
      merged.sparkColor,
      merged.glowColor,
      alpha
    );
  }
  ctx.restore();
}
