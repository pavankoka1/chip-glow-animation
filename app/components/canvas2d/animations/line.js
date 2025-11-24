import { hexToRgb } from "../utils";
import { LINE_SAMPLE_COUNT, MOBILE_LINE_SAMPLE_COUNT, GROWTH_PHASE_RATIO, EPSILON } from "../constants";
import { isMobileDevice } from "../mobileOptimization";
import { getLinePathPositionByDistance } from "./lineGeometry";

export function computeLinePathLength(centerX, centerY, rect, startPoint, direction) {
  if (!rect) {
    const fallbackPerimeter = 2 * (200 + 200);
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
  const perimeter = 2 * (rect.width + rect.height);

  return {
    pathLength: perimeter,
    startPoint,
    direction,
    halfWidth,
    halfHeight,
  };
}

export function computeLineMetrics(pathConfig, globalConfig, rect, centerX, centerY) {
  const startPoint = pathConfig.startPoint ?? 0;
  const direction = pathConfig.direction ?? globalConfig.direction ?? "clockwise";

  const pathResult = computeLinePathLength(centerX, centerY, rect, startPoint, direction);

  return {
    pathLength: pathResult.pathLength,
    centerX,
    centerY,
    startPoint: pathResult.startPoint,
    direction: pathResult.direction,
    halfWidth: pathResult.halfWidth,
    halfHeight: pathResult.halfHeight,
    isLine: true,
    rectWidth: rect?.width,
    rectHeight: rect?.height,
  };
}

function drawLinePath(
  ctx,
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  startPointRad,
  direction,
  iterations,
  length,
  lineWidth,
  color,
  glowRadius,
  glowColor,
  alpha,
  easedNormalizedTime,
  directionSign
) {
  const width = halfWidth * 2;
  const height = halfHeight * 2;
  const perimeter = 2 * (width + height);

  const defaultLength = (width + height) / 2;
  const targetLineLength = length !== undefined && length > 0 ? length : defaultLength;

  const totalTravelDistance = iterations * perimeter;

  let actualLineLength;
  let lineStartDistance;
  let lineEndDistance;

  if (easedNormalizedTime <= GROWTH_PHASE_RATIO) {
    const growthProgress = easedNormalizedTime / GROWTH_PHASE_RATIO;
    actualLineLength = targetLineLength * growthProgress;

    const startPointFraction = (((startPointRad % 360) + 360) % 360) / 360.0;
    lineStartDistance = startPointFraction * perimeter;
    lineEndDistance = lineStartDistance + actualLineLength * directionSign;
  } else {
    actualLineLength = targetLineLength;

    const movementProgress =
      (easedNormalizedTime - GROWTH_PHASE_RATIO) / (1 - GROWTH_PHASE_RATIO);

    const startPointFraction = (((startPointRad % 360) + 360) % 360) / 360.0;
    const baseStartDistance = startPointFraction * perimeter;

    const travelDistance = totalTravelDistance * movementProgress;
    lineStartDistance = baseStartDistance + travelDistance * directionSign;
    lineEndDistance = lineStartDistance + actualLineLength * directionSign;
  }

  if (actualLineLength <= 0) {
    return;
  }

  const normalizeDistance = (dist) => {
    let normalized = dist % perimeter;
    if (normalized < 0) normalized += perimeter;
    return normalized;
  };

  const actualStartDist = normalizeDistance(lineStartDistance);
  const actualEndDist = normalizeDistance(lineEndDistance);

  const wrapped =
    directionSign > 0
      ? lineEndDistance > perimeter && actualEndDist < actualStartDist
      : lineEndDistance < 0 && actualEndDist > actualStartDist;

  const shouldForceWrapForFullRound =
    Math.abs(actualLineLength - perimeter) < EPSILON && iterations >= 1;

  const finalWrapped = wrapped || shouldForceWrapForFullRound;

  const points = [];

  if (actualLineLength > 0) {
    if (finalWrapped) {
      if (directionSign > 0) {
        const firstPartLength = perimeter - actualStartDist;
        const secondPartLength =
          Math.abs(actualEndDist - actualStartDist) < EPSILON &&
          Math.abs(actualLineLength - perimeter) < EPSILON
            ? actualStartDist
            : actualEndDist;
        const totalLength = firstPartLength + secondPartLength;

        if (totalLength > 0) {
          const lineSampleCount = isMobileDevice() ? MOBILE_LINE_SAMPLE_COUNT : LINE_SAMPLE_COUNT;
          const firstPartSamples = Math.max(
            1,
            Math.floor(lineSampleCount * (firstPartLength / totalLength))
          );
          const secondPartSamples = Math.max(
            1,
            Math.floor(lineSampleCount * (secondPartLength / totalLength))
          );

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
        const firstPartLength = actualStartDist;
        const secondPartLength =
          Math.abs(actualEndDist - actualStartDist) < EPSILON &&
          Math.abs(actualLineLength - perimeter) < EPSILON
            ? perimeter - actualStartDist
            : perimeter - actualEndDist;
        const totalLength = firstPartLength + secondPartLength;

        if (totalLength > 0) {
          const lineSampleCount = isMobileDevice() ? MOBILE_LINE_SAMPLE_COUNT : LINE_SAMPLE_COUNT;
          const firstPartSamples = Math.max(
            1,
            Math.floor(lineSampleCount * (firstPartLength / totalLength))
          );
          const secondPartSamples = Math.max(
            1,
            Math.floor(lineSampleCount * (secondPartLength / totalLength))
          );

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
      const lineSampleCount = isMobileDevice() ? MOBILE_LINE_SAMPLE_COUNT : LINE_SAMPLE_COUNT;
      for (let i = 0; i <= lineSampleCount; i++) {
        const t = lineSampleCount > 0 ? i / lineSampleCount : 0;
        const distanceAlongLine = actualLineLength * t;
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

  let processedLineWidth = lineWidth;
  if (typeof lineWidth === "string") {
    processedLineWidth = Number.parseFloat(lineWidth);
  }

  const finalLineWidth =
    typeof processedLineWidth === "number" &&
    !Number.isNaN(processedLineWidth) &&
    processedLineWidth > 0
      ? processedLineWidth
      : 1;

  const [r, g, b] = hexToRgb(color);
  const [gr, gg, gb] = hexToRgb(glowColor);

  ctx.save();

  if (glowRadius > 0) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.strokeStyle = `rgba(${gr}, ${gg}, ${gb}, ${0.95 * alpha})`;
    ctx.lineWidth = finalLineWidth + glowRadius * 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  ctx.lineWidth = finalLineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.restore();
}

export function renderLine(
  ctx,
  pathConfig,
  globalConfig,
  metrics,
  easedNormalizedTime,
  alpha
) {
  const sparkColor = pathConfig.sparkColor ?? globalConfig.sparkColor ?? "#ffff00";
  const glowColor = pathConfig.glowColor ?? globalConfig.glowColor ?? "#fff391";
  const glowRadius = pathConfig.glowRadius ?? globalConfig.glowRadius ?? 30;

  let pathValue = pathConfig.lineWidth;
  let globalValue = globalConfig.lineWidth;
  if (typeof pathValue === "string") {
    pathValue = Number.parseFloat(pathValue);
  }
  if (typeof globalValue === "string") {
    globalValue = Number.parseFloat(globalValue);
  }
  const lineWidth =
    (typeof pathValue === "number" && !Number.isNaN(pathValue) && pathValue > 0)
      ? pathValue
      : (typeof globalValue === "number" && !Number.isNaN(globalValue) && globalValue > 0)
      ? globalValue
      : 1;

  const iterations = pathConfig.iterations ?? globalConfig.iterations ?? 1;
  const lineLength =
    pathConfig.length !== undefined &&
    typeof pathConfig.length === "number" &&
    pathConfig.length > 0
      ? pathConfig.length
      : undefined;
  const startPoint = pathConfig.startPoint ?? globalConfig.startPoint ?? 0;
  const direction = pathConfig.direction === "anticlockwise" ? "anticlockwise" : "clockwise";

  const centerX = metrics.centerX;
  const centerY = metrics.centerY;
  const halfWidth = metrics.halfWidth ?? 50;
  const halfHeight = metrics.halfHeight ?? 50;
  const directionSign = direction === "anticlockwise" ? -1 : 1;

  drawLinePath(
    ctx,
    centerX,
    centerY,
    halfWidth,
    halfHeight,
    startPoint,
    direction,
    iterations,
    lineLength,
    lineWidth,
    sparkColor,
    glowRadius,
    glowColor,
    alpha,
    easedNormalizedTime,
    directionSign
  );
}

