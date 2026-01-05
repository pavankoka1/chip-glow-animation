/**
 * Point generation logic for SparkSpinWebGL animation
 */

import { SPARK_SPIN_ROTATIONS, DEFAULT_BORDER_RADIUS } from "./sparkSpinConstants";
import { getCornerArcPosition, getPositionFromSpinPath } from "./spinPathUtils";

/**
 * Calculate vertices for the rounded rectangle path
 */
function calculateVertices(centerX, centerY, halfWidth, halfHeight, borderRadius) {
  return [
    { x: centerX, y: centerY - halfHeight, type: "edge", name: "top" },
    {
      x: centerX + halfWidth - borderRadius,
      y: centerY - halfHeight,
      type: "corner",
      name: "TR",
    },
    { x: centerX + halfWidth, y: centerY, type: "edge", name: "right" },
    {
      x: centerX + halfWidth,
      y: centerY + halfHeight - borderRadius,
      type: "corner",
      name: "BR",
    },
    { x: centerX, y: centerY + halfHeight, type: "edge", name: "bottom" },
    {
      x: centerX - halfWidth + borderRadius,
      y: centerY + halfHeight,
      type: "corner",
      name: "BL",
    },
    { x: centerX - halfWidth, y: centerY, type: "edge", name: "left" },
    {
      x: centerX - halfWidth,
      y: centerY - halfHeight + borderRadius,
      type: "corner",
      name: "TL",
    },
  ];
}

/**
 * Calculate segment distances and cumulative distances
 */
function calculateSegmentDistances(vertices, centerX, centerY, halfWidth, halfHeight, borderRadius) {
  const segmentDistances = [];
  const cumulativeDistances = [0];
  let totalPerimeterCalc = 0;

  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % vertices.length];

    let segmentDist = 0;
    if (v1.type === "edge" && v2.type === "corner") {
      const dx = v2.x - v1.x;
      const dy = v2.y - v1.y;
      segmentDist = Math.sqrt(dx * dx + dy * dy);
    } else if (v1.type === "corner" && v2.type === "edge") {
      const arcLength = (Math.PI / 2) * borderRadius;
      const cornerEnd = getCornerArcPosition(
        v1.name,
        1.0,
        centerX,
        centerY,
        halfWidth,
        halfHeight,
        borderRadius
      );
      const dx = v2.x - cornerEnd.x;
      const dy = v2.y - cornerEnd.y;
      const straightLength = Math.sqrt(dx * dx + dy * dy);
      segmentDist = arcLength + straightLength;
    } else {
      const dx = v2.x - v1.x;
      const dy = v2.y - v1.y;
      segmentDist = Math.sqrt(dx * dx + dy * dy);
    }

    segmentDistances.push(segmentDist);
    totalPerimeterCalc += segmentDist;
    cumulativeDistances.push(totalPerimeterCalc);
  }

  return { segmentDistances, cumulativeDistances, totalPerimeter: totalPerimeterCalc };
}

/**
 * Calculate head taper radius
 */
function calculateHeadTaperRadius(along01, merged) {
  const headTaperRatio = merged.headTaperRatio || 0.08;
  let radius;
  
  if (headTaperRatio > 0 && along01 > 1 - headTaperRatio) {
    const tipT = (along01 - (1 - headTaperRatio)) / headTaperRatio;
    let smoothness = Math.cos((tipT * Math.PI) / 2);

    if (merged.headCurve > 0) {
      const curvePower = 1.0 + merged.headCurve * 2.0;
      smoothness = Math.pow(smoothness, 1.0 / curvePower);
    }

    const tipRadius = merged.tailRadius * 0.25;
    radius = tipRadius + (merged.headRadius - tipRadius) * smoothness;
  } else {
    radius = merged.tailRadius + (merged.headRadius - merged.tailRadius) * along01;
  }
  
  return Math.max(1, radius);
}

/**
 * Generate points for a single spark along the spin path
 */
function generateSparkPoints(
  sparkIndex,
  baseStartDistance,
  travelDistance,
  lengthPx,
  totalPerimeter,
  sampleCount,
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  borderRadius,
  vertices,
  segmentDistances,
  cumulativeDistances
) {
  const lineStartDistance = baseStartDistance + travelDistance;
  const lineEndDistance = lineStartDistance + lengthPx;

  const normalizeDistance = (dist) => {
    let normalized = dist % totalPerimeter;
    if (normalized < 0) normalized += totalPerimeter;
    return normalized;
  };

  const actualStartDist = normalizeDistance(lineStartDistance);
  const actualEndDist = normalizeDistance(lineEndDistance);
  const wrapped = lineEndDistance > totalPerimeter && actualEndDist < actualStartDist;

  const sparkPoints = [];

  if (wrapped) {
    const firstPartLength = totalPerimeter - actualStartDist;
    const secondPartLength = actualEndDist;
    const totalLength = firstPartLength + secondPartLength;

    if (totalLength > 0) {
      const firstPartSamples = Math.max(1, Math.floor(sampleCount * (firstPartLength / totalLength)));
      const secondPartSamples = Math.max(1, Math.floor(sampleCount * (secondPartLength / totalLength)));

      for (let i = 0; i <= firstPartSamples; i++) {
        const t = firstPartSamples > 0 ? i / firstPartSamples : 0;
        const clampedT = i === firstPartSamples ? 0.999 : t;
        const distance = actualStartDist + firstPartLength * clampedT;
        const pos = getPositionFromSpinPath(
          distance,
          centerX,
          centerY,
          halfWidth,
          halfHeight,
          borderRadius,
          vertices,
          segmentDistances,
          cumulativeDistances
        );
        if (pos) sparkPoints.push({ ...pos, distance });
      }

      for (let i = 0; i <= secondPartSamples; i++) {
        const t = secondPartSamples > 0 ? i / secondPartSamples : 0;
        const offsetT = i === 0 ? 0.001 : t;
        const distance = secondPartLength * offsetT;
        const pos = getPositionFromSpinPath(
          distance,
          centerX,
          centerY,
          halfWidth,
          halfHeight,
          borderRadius,
          vertices,
          segmentDistances,
          cumulativeDistances
        );
        if (pos) sparkPoints.push({ ...pos, distance });
      }
    }
  } else {
    for (let i = 0; i <= sampleCount; i++) {
      const t = sampleCount > 0 ? i / sampleCount : 0;
      const distanceAlongLine = lengthPx * t;
      const distance = actualStartDist + distanceAlongLine;
      const normalizedDist = normalizeDistance(distance);
      const pos = getPositionFromSpinPath(
        normalizedDist,
        centerX,
        centerY,
        halfWidth,
        halfHeight,
        borderRadius,
        vertices,
        segmentDistances,
        cumulativeDistances
      );
      if (pos) sparkPoints.push({ ...pos, distance: normalizedDist });
    }
  }

  return sparkPoints;
}

/**
 * Generate all points for spark spin animation
 */
export function generateSparkSpinPoints(metrics, normalizedTime, merged, sparkColorRgb, anchorCenterRef, anchorRectRef) {
  if (!metrics) {
    return [];
  }

  const points = [];
  const centerX = anchorCenterRef.current.x;
  const centerY = anchorCenterRef.current.y;
  const rect = anchorRectRef.current;

  const betspotWidth = rect ? rect.width : 100;
  // Use length from config if provided (in pixels), otherwise default to betspotWidth / 2
  const lengthPx = merged.length !== undefined ? merged.length : betspotWidth / 2;

  const halfWidth = metrics.halfWidth ?? 50;
  const halfHeight = metrics.halfHeight ?? 50;
  const borderRadius = merged.borderRadius ?? DEFAULT_BORDER_RADIUS;

  const vertices = calculateVertices(centerX, centerY, halfWidth, halfHeight, borderRadius);
  const { segmentDistances, cumulativeDistances, totalPerimeter } = calculateSegmentDistances(
    vertices,
    centerX,
    centerY,
    halfWidth,
    halfHeight,
    borderRadius
  );

  const halfPerimeter = totalPerimeter / 2;
  const totalTravelDistance = SPARK_SPIN_ROTATIONS * totalPerimeter;
  const travelDistance = totalTravelDistance * normalizedTime;

  const baseStartDistance0 = cumulativeDistances[0];
  const baseStartDistance1 = (baseStartDistance0 + halfPerimeter) % totalPerimeter;
  const sparkStartDistances = [baseStartDistance0, baseStartDistance1];

  const sampleCount = merged.dotCount || 100;

  for (let sparkIndex = 0; sparkIndex < 2; sparkIndex++) {
    const baseStartDistance = sparkStartDistances[sparkIndex];
    const sparkPoints = generateSparkPoints(
      sparkIndex,
      baseStartDistance,
      travelDistance,
      lengthPx,
      totalPerimeter,
      sampleCount,
      centerX,
      centerY,
      halfWidth,
      halfHeight,
      borderRadius,
      vertices,
      segmentDistances,
      cumulativeDistances
    );

    for (let i = 0; i < sparkPoints.length; i++) {
      const p = sparkPoints[i];
      const along01 = sparkPoints.length > 1 ? i / (sparkPoints.length - 1) : 0;
      const radius = calculateHeadTaperRadius(along01, merged);

      points.push({
        x: p.x,
        y: p.y,
        radius,
        color: sparkColorRgb,
        alpha: 1.0,
        along01,
        glowRadius: merged.glowRadius,
      });
    }
  }

  return points;
}

