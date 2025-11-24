import {
  getEllipsePosition2D,
  isPointInsideBetSpot,
  calculateAutoA,
} from "../geometry";
import { getAngleForVertex } from "../utils";
import { drawGlowPoint } from "../rendering";
import {
  INTERSECTION_SAMPLE_COUNT,
  OUTSIDE_THRESHOLD,
  SAMPLE_COUNT,
  EPSILON,
} from "../constants";

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

  for (let i = 1; i <= INTERSECTION_SAMPLE_COUNT; i++) {
    const t = i / INTERSECTION_SAMPLE_COUNT;
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

export function computeSparkMetrics(pathConfig, globalConfig, rect, centerX, centerY) {
  if (!pathConfig.startVertex || !pathConfig.endVertex) {
    return null;
  }

  const startDir = getAngleForVertex(pathConfig.startVertex);
  const endDir = getAngleForVertex(pathConfig.endVertex);
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
  let bVal = ellipseCfg?.b ?? 0.0;
  if (rect && autoA === undefined) {
    autoA = calculateAutoA(rect, 10);
  } else if (autoA === undefined) {
    autoA = 150;
  }

  const ellipseTiltDeg = pathConfig.ellipseTiltDeg ?? globalConfig.ellipseTiltDeg ?? 0;
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

  return {
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
  anchorEl
) {
  const merged = {
    headRadius: pathConfig.headRadius ?? globalConfig.headRadius ?? 10,
    tailRadius: pathConfig.tailRadius ?? globalConfig.tailRadius ?? 2,
    sparkColor: pathConfig.sparkColor ?? globalConfig.sparkColor ?? "#ffff00",
    glowColor: pathConfig.glowColor ?? globalConfig.glowColor ?? "#fff391",
    glowRadius: pathConfig.glowRadius ?? globalConfig.glowRadius ?? 30,
  };

  const [centerX, centerY] = [metrics.centerX, metrics.centerY];
  const a = metrics.a;
  const b = metrics.b;
  const rotAngle = metrics.rotAngle;
  const thetaStartLocal = 0.0;
  const actualThetaEnd = metrics.actualThetaEnd ?? metrics.thetaEndLocal;

  const rect = anchorEl?.getBoundingClientRect ? anchorEl.getBoundingClientRect() : null;
  const halfWidth = rect ? rect.width / 2 : 50;
  const halfHeight = rect ? rect.height / 2 : 50;

  const initialPathEndTheta = Math.abs(metrics.thetaEndLocal ?? actualThetaEnd);
  const totalPathRange = Math.abs(actualThetaEnd - thetaStartLocal);
  const initialPathRange = Math.abs(initialPathEndTheta - thetaStartLocal);
  const initialPathRatio = initialPathRange / Math.max(totalPathRange, EPSILON);

  const points = [];

  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const t = segTail + (segHead - segTail) * (i / SAMPLE_COUNT);
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

    const along01 = i / SAMPLE_COUNT;
    const radius = merged.tailRadius + (merged.headRadius - merged.tailRadius) * along01;
    points.push({ x, y, radius, along01 });
  }

  ctx.save();
  for (const point of points) {
    const pointAlpha = point.alpha !== undefined ? point.alpha : alpha;
    const glowRadius =
      point.glowRadiusMultiplier !== undefined
        ? merged.glowRadius * point.glowRadiusMultiplier
        : merged.glowRadius;

    drawGlowPoint(
      ctx,
      point.x,
      point.y,
      point.radius,
      glowRadius,
      merged.sparkColor,
      merged.glowColor,
      pointAlpha
    );
  }
  ctx.restore();
}

