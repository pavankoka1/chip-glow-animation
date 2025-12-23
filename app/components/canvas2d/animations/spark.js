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
    // For smaller betspots, reduce the offset to decrease 'a' appropriately
    // For 100x100: offset 10 gives a ≈ 80.71
    // For 43x46: reduce offset to 5 to get a ≈ 36.49 (instead of 41.49)
    const minDimension = Math.min(rect.width, rect.height);
    const offset = minDimension < 50 ? 6 : 10;
    autoA = calculateAutoA(rect, offset);
  } else if (autoA === undefined) {
    autoA = 150;
  }

  // Calculate 'b' dynamically to maintain proportional ellipse shape
  // If 'b' is not provided in config, calculate it relative to BetSpot size
  // Scale b proportionally with 'a' to maintain consistent ellipse shape across different betspot sizes
  if (bVal === undefined || bVal === null) {
    if (rect) {
      // Calculate b proportionally to 'a' to maintain consistent visual appearance
      // For 100x100 BetSpot: a ≈ 80.71, b = 20 (ratio ~4:1, b/a ≈ 0.248)
      // For smaller betspots (like 43x46), we need proportionally smaller b values
      const minDimension = Math.min(rect.width, rect.height);
      const maxDimension = Math.max(rect.width, rect.height);
      const aspectRatio = maxDimension / minDimension;

      // Calculate b based on 'a' to maintain proportional scaling
      // For smaller betspots (< 50px), use a reduced ratio to decrease b appropriately
      // This ensures the ellipse doesn't appear too wide for smaller betspots
      const baseRatio = minDimension < 50 ? 0.18 : 0.248;
      const baseB = autoA * baseRatio;

      // For non-square rectangles, adjust slightly based on aspect ratio
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
  glowRadius,
  dotCount,
  length
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

  // Use dotCount from config if provided, otherwise fall back to default
  const sampleCount =
    dotCount ?? (isMobileDevice() ? MOBILE_SAMPLE_COUNT : SAMPLE_COUNT);

  // Apply length multiplier to the span (0-1, where 1 means full span)
  const lengthMultiplier = length ?? 1.0;
  const effectiveSpan = totalSpan * lengthMultiplier;
  const effectiveSegHead = segTail + (segHead - segTail) * lengthMultiplier;

  // Head tapering (tip) logic
  const headTaperRatio =
    pathConfig.headTaperRatio ?? globalConfig.headTaperRatio ?? 0.0;
  const tipRadius =
    pathConfig.tipRadius ?? globalConfig.tipRadius ?? tailRadius;

  for (let i = 0; i <= sampleCount; i++) {
    const t = segTail + (effectiveSegHead - segTail) * (i / sampleCount);
    const tClamped = Math.max(0, Math.min(effectiveSpan, t));

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

    // Head tapering logic
    let radius;
    if (headTaperRatio > 0 && along01 > 1.0 - headTaperRatio) {
      // Tip: parabolic tapering for a smoother, rounded "bullet" profile
      const tipT = (along01 - (1.0 - headTaperRatio)) / headTaperRatio;
      const smoothness = Math.cos((tipT * Math.PI) / 2.0);
      radius = tipRadius + (headRadius - tipRadius) * smoothness;
    } else if (headTaperRatio > 0) {
      // Body: growing from tailRadius to headRadius peaking at taper start
      const bodyT = along01 / (1.0 - headTaperRatio);
      radius = tailRadius + (headRadius - tailRadius) * bodyT;
    } else {
      // Standard linear interpolation if no tapering
      radius = tailRadius + (headRadius - tailRadius) * along01;
    }

    pointsArray.push({
      x,
      y,
      radius,
      sparkColor: sparkColorRgb,
      glowColor: glowColorRgb,
      alpha,
      glowRadius:
        radius *
        (pathConfig.glowRadiusMultiplier ??
          globalConfig.glowRadiusMultiplier ??
          1.0),
    });
  }
}
