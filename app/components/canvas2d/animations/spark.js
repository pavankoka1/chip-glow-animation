import {
  EPSILON,
  INTERSECTION_SAMPLE_COUNT,
  MOBILE_INTERSECTION_SAMPLE_COUNT,
  MOBILE_SAMPLE_COUNT,
  OUTSIDE_THRESHOLD,
  SAMPLE_COUNT,
} from "../constants";
import {
  calculateAutoA,
  getAngleForVertexFromRect,
  getEllipsePosition2D,
  isPointInsideBetSpot,
} from "../geometry";
import { isMobileDevice } from "../mobileOptimization";
import { drawGlowPoint } from "../rendering";

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
  ellipseRotationDeg
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

export function computeSparkPathLength(
  a,
  b,
  rotAngle,
  thetaStart,
  thetaEnd,
  centerX,
  centerY,
  ellipseTiltDeg,
  rect,
  ellipseRotationDeg
) {
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
    ellipseRotationDeg
  );

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

  const intersectionSamples = isMobileDevice()
    ? MOBILE_INTERSECTION_SAMPLE_COUNT
    : INTERSECTION_SAMPLE_COUNT;
  for (let i = 1; i <= intersectionSamples; i++) {
    const t = i / intersectionSamples;
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

export function getSparkPathPosition(
  t,
  a,
  b,
  rotAngle,
  thetaStart,
  thetaEnd,
  centerX,
  centerY,
  ellipseTiltDeg,
  ellipseRotationDeg
) {
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

export function computeSparkMetrics(
  pathConfig,
  globalConfig,
  rect,
  centerX,
  centerY
) {
  if (!pathConfig.startVertex || !pathConfig.endVertex) {
    return null;
  }

  // Calculate angles from actual vertex coordinates to support non-square rectangles
  // This ensures vertices are positioned correctly regardless of aspect ratio
  const startDir = getAngleForVertexFromRect(pathConfig.startVertex, rect);
  const endDir = getAngleForVertexFromRect(pathConfig.endVertex, rect);

  const delta =
    ((((endDir - startDir + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) %
      (2 * Math.PI)) -
    Math.PI;
  const dir = Math.sign(delta) || 1;

  const direction = pathConfig.direction ?? globalConfig.direction ?? "auto";
  let finalDir = dir;
  if (direction === "anticlockwise") {
    finalDir = -1;
  } else if (direction === "clockwise") {
    finalDir = 1;
  }

  const thetaStartLocal = 0.0;
  const thetaEndLocal = finalDir * Math.abs(delta || Math.PI);
  const rotAngle = startDir;

  const ellipseCfg = pathConfig.ellipse || globalConfig.ellipse;
  let autoA = ellipseCfg?.a;
  let bVal = ellipseCfg?.b;

  // Always calculate 'a' dynamically from BetSpot size if rect is available
  // This ensures the ellipse scales with BetSpot size, ignoring config value
  // Only use config value if rect is not available
  if (rect) {
    autoA = calculateAutoA(rect, 10);
  } else if (autoA === undefined) {
    autoA = 150;
  }

  // Calculate 'b' dynamically to maintain proportional ellipse shape
  // If 'b' is not provided in config, calculate it relative to BetSpot size
  // For non-square rectangles, scale b based on the smaller dimension
  if (bVal === undefined || bVal === null) {
    if (rect) {
      // Calculate b proportionally to maintain similar ellipse shape
      // Use the smaller dimension to ensure the ellipse fits well
      // For 100x100 BetSpot: a ≈ 80.71, b = 20 (ratio ~4:1)
      // For non-square: scale b based on min dimension to maintain aspect ratio
      const minDimension = Math.min(rect.width, rect.height);
      const maxDimension = Math.max(rect.width, rect.height);
      // Scale b proportionally: maintain ~4:1 ratio with a
      // But also account for aspect ratio - if very wide/tall, adjust
      const aspectRatio = maxDimension / minDimension;
      // Base calculation: minDimension * 0.2 (works for square)
      // Adjust slightly for extreme aspect ratios
      const baseB = minDimension * 0.2;
      // For very wide/tall rectangles, reduce b slightly to keep ellipse proportional
      bVal = baseB / Math.sqrt(aspectRatio);
    } else {
      // Fallback: maintain ratio with default a = 150
      bVal = autoA * 0.2475; // Maintains ~4:1 ratio
    }
  } else {
  }

  const ellipseTiltDeg =
    pathConfig.ellipseTiltDeg ?? globalConfig.ellipseTiltDeg ?? 0;
  const ellipseRotationDeg =
    pathConfig.ellipseRotationDeg ?? globalConfig.ellipseRotationDeg ?? 0;

  const pathResult = computeSparkPathLength(
    autoA,
    bVal,
    rotAngle,
    thetaStartLocal,
    thetaEndLocal,
    centerX,
    centerY,
    ellipseTiltDeg,
    rect,
    ellipseRotationDeg
  );

  const metrics = {
    pathLength: pathResult.pathLength,
    thetaEndLocal,
    actualThetaEnd: pathResult.actualThetaEnd,
    rotAngle,
    dir: finalDir,
    direction,
    centerX,
    centerY,
    a: autoA,
    b: bVal,
    ellipseTiltDeg,
    ellipseRotationDeg,
    isCircle: false,
    rectWidth: rect?.width,
    rectHeight: rect?.height,
  };

  return metrics;
}

export function renderSpark(
  ctx,
  pathConfig,
  globalConfig,
  metrics,
  segTail,
  segHead,
  totalSpan,
  alpha,
  rect
) {
  const headRadius = pathConfig.headRadius ?? globalConfig.headRadius ?? 10;
  const tailRadius = pathConfig.tailRadius ?? globalConfig.tailRadius ?? 2;
  const sparkColor =
    pathConfig.sparkColor ?? globalConfig.sparkColor ?? "#ffff00";
  const glowColor = pathConfig.glowColor ?? globalConfig.glowColor ?? "#fff391";
  const glowRadius = pathConfig.glowRadius ?? globalConfig.glowRadius ?? 30;

  const centerX = metrics.centerX;
  const centerY = metrics.centerY;
  const a = metrics.a;
  const b = metrics.b;
  const rotAngle = metrics.rotAngle;
  const thetaStartLocal = 0.0;
  const actualThetaEnd = metrics.actualThetaEnd ?? metrics.thetaEndLocal;

  const halfWidth = rect ? rect.width / 2 : 50;
  const halfHeight = rect ? rect.height / 2 : 50;

  const initialPathEndTheta = Math.abs(metrics.thetaEndLocal ?? actualThetaEnd);
  const totalPathRange = Math.abs(actualThetaEnd - thetaStartLocal);
  const initialPathRange = Math.abs(initialPathEndTheta - thetaStartLocal);
  const initialPathRatio = initialPathRange / Math.max(totalPathRange, EPSILON);

  const points = [];
  const sampleCount = isMobileDevice() ? MOBILE_SAMPLE_COUNT : SAMPLE_COUNT;

  for (let i = 0; i <= sampleCount; i++) {
    const t = segTail + (segHead - segTail) * (i / sampleCount);
    const tClamped = Math.max(0, Math.min(totalSpan, t));

    const [x, y] = getSparkPathPosition(
      tClamped,
      a,
      b,
      rotAngle,
      thetaStartLocal,
      actualThetaEnd,
      centerX,
      centerY,
      metrics.ellipseTiltDeg,
      metrics.ellipseRotationDeg
    );

    const isPastInitialPath = tClamped > initialPathRatio;

    if (isPastInitialPath) {
      const isInside =
        x >= centerX - halfWidth &&
        x <= centerX + halfWidth &&
        y >= centerY - halfHeight &&
        y <= centerY + halfHeight;
      if (isInside) {
        break;
      }
    }

    const along01 = i / sampleCount;
    const radius = tailRadius + (headRadius - tailRadius) * along01;
    points.push({ x, y, radius });
  }

  ctx.save();
  for (const point of points) {
    drawGlowPoint(
      ctx,
      point.x,
      point.y,
      point.radius,
      glowRadius,
      sparkColor,
      glowColor,
      alpha
    );
  }
  ctx.restore();
}

export function renderSparkToPoints(
  pointsArray,
  pathConfig,
  globalConfig,
  metrics,
  segTail,
  segHead,
  totalSpan,
  alpha,
  rect,
  headRadius,
  tailRadius,
  sparkColorRgb,
  glowColorRgb,
  glowRadius
) {
  const centerX = metrics.centerX;
  const centerY = metrics.centerY;
  const a = metrics.a;
  const b = metrics.b;
  const rotAngle = metrics.rotAngle;
  const thetaStartLocal = 0.0;
  const actualThetaEnd = metrics.actualThetaEnd ?? metrics.thetaEndLocal;

  const halfWidth = rect ? rect.width / 2 : 50;
  const halfHeight = rect ? rect.height / 2 : 50;

  const initialPathEndTheta = Math.abs(metrics.thetaEndLocal ?? actualThetaEnd);
  const totalPathRange = Math.abs(actualThetaEnd - thetaStartLocal);
  const initialPathRange = Math.abs(initialPathEndTheta - thetaStartLocal);
  const initialPathRatio = initialPathRange / Math.max(totalPathRange, EPSILON);

  const sampleCount = isMobileDevice() ? MOBILE_SAMPLE_COUNT : SAMPLE_COUNT;

  for (let i = 0; i <= sampleCount; i++) {
    const t = segTail + (segHead - segTail) * (i / sampleCount);
    const tClamped = Math.max(0, Math.min(totalSpan, t));

    const [x, y] = getSparkPathPosition(
      tClamped,
      a,
      b,
      rotAngle,
      thetaStartLocal,
      actualThetaEnd,
      centerX,
      centerY,
      metrics.ellipseTiltDeg,
      metrics.ellipseRotationDeg
    );

    const isPastInitialPath = tClamped > initialPathRatio;

    if (isPastInitialPath) {
      const isInside =
        x >= centerX - halfWidth &&
        x <= centerX + halfWidth &&
        y >= centerY - halfHeight &&
        y <= centerY + halfHeight;
      if (isInside) {
        break;
      }
    }

    const along01 = i / sampleCount;
    const radius = tailRadius + (headRadius - tailRadius) * along01;
    pointsArray.push({
      x,
      y,
      radius,
      sparkColor: sparkColorRgb,
      glowColor: glowColorRgb,
      alpha,
      glowRadius,
    });
  }
}
