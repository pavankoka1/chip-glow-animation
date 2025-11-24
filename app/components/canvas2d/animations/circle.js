import {
  getVertexCoords,
  getEllipsePosition2D,
  calculateAutoA,
  getDynamicRotAngle,
} from "../geometry";
import {
  PATH_SAMPLE_COUNT,
  MOBILE_PATH_SAMPLE_COUNT,
  SAMPLE_COUNT,
  MOBILE_SAMPLE_COUNT,
  CIRCLE_ROTATIONS,
  TOLERANCE,
  MAX_ITERATIONS,
  EPSILON,
} from "../constants";
import { drawGlowPoint } from "../rendering";
import { isMobileDevice } from "../mobileOptimization";

function findThetaFromPoint(targetX, targetY, getEllipsePosMath, initialGuess = 0) {
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

    while (theta < 0) theta += 2 * Math.PI;
    while (theta >= 2 * Math.PI) theta -= 2 * Math.PI;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const [x, y] = getEllipsePosMath(theta);
      const dx = x - targetX;
      const dy = y - targetY;
      const error = Math.hypot(dx, dy);

      if (error < TOLERANCE) {
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
}

export function computeCirclePathLength(
  a,
  b,
  rotAngle,
  centerX,
  centerY,
  circleRadius,
  rect,
  startVertex,
  direction
) {
  const [startVertexX, startVertexY] = getVertexCoords(startVertex, rect);

  const getEllipsePosMath = (theta) => {
    const x_local = a * Math.cos(theta);
    const y_local = b * Math.sin(theta);
    const c = Math.cos(rotAngle);
    const s = Math.sin(rotAngle);
    const x_math = c * x_local - s * y_local;
    const y_math = s * x_local + c * y_local;
    return [x_math, y_math];
  };

  const getEllipsePos = (theta) => {
    const [x_math, y_math] = getEllipsePosMath(theta);
    const x = x_math + centerX;
    const y = -y_math + centerY;
    return [x, y];
  };

  const startAngle = Math.atan2(startVertexY, startVertexX);
  const directionSign = direction === "anticlockwise" ? 1 : -1;
  const meetingAngle = startAngle + (directionSign * Math.PI) / 2;
  const meetingPointX = circleRadius * Math.cos(meetingAngle);
  const meetingPointY = circleRadius * Math.sin(meetingAngle);

  let MEETING_THETA = findThetaFromPoint(
    meetingPointX,
    meetingPointY,
    getEllipsePosMath,
    meetingAngle
  );

  const startVertexAngle = Math.atan2(startVertexY, startVertexX);
  let START_THETA = findThetaFromPoint(
    startVertexX,
    startVertexY,
    getEllipsePosMath,
    startVertexAngle
  );

  const [verifyStartX, verifyStartY] = getEllipsePosMath(START_THETA);
  let startError = Math.hypot(verifyStartX - startVertexX, verifyStartY - startVertexY);

  if (startError > 1.0) {
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

  const ellipseSamples = isMobileDevice() ? 32 : 64;
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

  const circlePathLength = CIRCLE_ROTATIONS * 2 * Math.PI * circleRadius;
  const totalPathLength = ellipsePathLength + circlePathLength;
  const ellipsePortion = ellipsePathLength / totalPathLength;
  const circlePortion = circlePathLength / totalPathLength;

  const [meetingX_math, meetingY_math] = getEllipsePosMath(MEETING_THETA);
  const meetingCircleAngle = Math.atan2(meetingY_math, meetingX_math);

  return {
    pathLength: totalPathLength,
    startTheta: START_THETA,
    meetingTheta: MEETING_THETA,
    ellipsePortion,
    circlePortion,
    meetingCircleAngle,
    direction,
  };
}

export function getCirclePathPosition(
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
  direction
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
    const totalRotation = CIRCLE_ROTATIONS * 2 * Math.PI;
    const directionSign = direction === "anticlockwise" ? 1 : -1;
    const angle = meetingCircleAngle + directionSign * totalRotation * circleT;
    const x_math = circleRadius * Math.cos(angle);
    const y_math = circleRadius * Math.sin(angle);
    const x = x_math + centerX;
    const y = -y_math + centerY;
    return [x, y];
  }
}

export function computeCircleMetrics(pathConfig, globalConfig, rect, centerX, centerY) {
  const circleRadius = pathConfig.circleRadius ?? 30;
  let autoA;
  if (rect) {
    const diagonal = Math.hypot(rect.width, rect.height);
    autoA = diagonal / 2;
  } else {
    autoA = 141.4214;
  }

  const bVal = circleRadius;
  const startVertex = pathConfig.startVertex || "BR";
  const direction = pathConfig.direction ?? globalConfig.direction ?? "clockwise";
  const dynamicRotAngle = getDynamicRotAngle(startVertex);

  const pathResult = computeCirclePathLength(
    autoA,
    bVal,
    dynamicRotAngle,
    centerX,
    centerY,
    circleRadius,
    rect,
    startVertex,
    direction
  );

  return {
    pathLength: pathResult.pathLength,
    startTheta: pathResult.startTheta,
    meetingTheta: pathResult.meetingTheta,
    rotAngle: dynamicRotAngle,
    ellipsePortion: pathResult.ellipsePortion,
    circlePortion: pathResult.circlePortion,
    meetingCircleAngle: pathResult.meetingCircleAngle,
    direction: pathResult.direction,
    centerX,
    centerY,
    a: autoA,
    b: bVal,
    circleRadius,
    startVertex,
    isCircle: true,
  };
}

export function renderCircle(
  ctx,
  pathConfig,
  globalConfig,
  metrics,
  segTail,
  segHead,
  totalSpan,
  alpha
) {
  const headRadius = pathConfig.headRadius ?? globalConfig.headRadius ?? 10;
  const tailRadius = pathConfig.tailRadius ?? globalConfig.tailRadius ?? 2;
  const sparkColor = pathConfig.sparkColor ?? globalConfig.sparkColor ?? "#ffff00";
  const glowColor = pathConfig.glowColor ?? globalConfig.glowColor ?? "#fff391";
  const glowRadius = pathConfig.glowRadius ?? globalConfig.glowRadius ?? 30;
  const direction = pathConfig.direction ?? globalConfig.direction ?? "clockwise";

  const centerX = metrics.centerX;
  const centerY = metrics.centerY;
  const a = metrics.a;
  const b = metrics.b;
  const rotAngle = metrics.rotAngle;
  const circleRadius = metrics.circleRadius;

  const points = [];
  const sampleCount = isMobileDevice() ? MOBILE_SAMPLE_COUNT : SAMPLE_COUNT;

  for (let i = 0; i <= sampleCount; i++) {
    const t = segTail + (segHead - segTail) * (i / sampleCount);
    const tClamped = Math.max(0, Math.min(totalSpan, t));

    const [x, y] = getCirclePathPosition(
      tClamped,
      a,
      b,
      rotAngle,
      centerX,
      centerY,
      circleRadius,
      metrics.startTheta ?? 0,
      metrics.meetingTheta ?? 0,
      metrics.ellipsePortion ?? 0.5,
      metrics.circlePortion ?? 0.5,
      metrics.meetingCircleAngle ?? 0,
      direction
    );

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

