/**
 * Utility functions for calculating positions along spin path
 */

import { EPSILON } from "./sparkSpinConstants";

/**
 * Get corner arc position for a given corner name and progress
 */
export function getCornerArcPosition(
  cornerName,
  t,
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  borderRadius
) {
  const br = borderRadius;
  const w = halfWidth;
  const h = halfHeight;

  let cornerCenter;
  let startAngle;

  switch (cornerName) {
    case "TL":
      cornerCenter = { x: centerX - w + br, y: centerY - h + br };
      startAngle = Math.PI;
      let angleTL = startAngle + (Math.PI / 2) * t;
      while (angleTL > Math.PI) angleTL -= 2 * Math.PI;
      while (angleTL < -Math.PI) angleTL += 2 * Math.PI;
      return {
        x: cornerCenter.x + br * Math.cos(angleTL),
        y: cornerCenter.y + br * Math.sin(angleTL),
      };
    case "TR":
      cornerCenter = { x: centerX + w - br, y: centerY - h + br };
      startAngle = -Math.PI / 2;
      const angleTR = startAngle + (Math.PI / 2) * t;
      return {
        x: cornerCenter.x + br * Math.cos(angleTR),
        y: cornerCenter.y + br * Math.sin(angleTR),
      };
    case "BR":
      cornerCenter = { x: centerX + w - br, y: centerY + h - br };
      startAngle = 0;
      const angleBR = startAngle + (Math.PI / 2) * t;
      return {
        x: cornerCenter.x + br * Math.cos(angleBR),
        y: cornerCenter.y + br * Math.sin(angleBR),
      };
    case "BL":
      cornerCenter = { x: centerX - w + br, y: centerY + h - br };
      startAngle = Math.PI / 2;
      const angleBL = startAngle + (Math.PI / 2) * t;
      return {
        x: cornerCenter.x + br * Math.cos(angleBL),
        y: cornerCenter.y + br * Math.sin(angleBL),
      };
    default:
      return { x: centerX, y: centerY };
  }
}

/**
 * Get position from distance along spin path
 */
export function getPositionFromSpinPath(
  distance,
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  borderRadius,
  vertices,
  segmentDistances,
  cumulativeDistances
) {
  const br = Math.min(borderRadius, Math.min(halfWidth, halfHeight));

  // Find segment
  let segmentIdx = 0;
  for (let i = 0; i < cumulativeDistances.length - 1; i++) {
    if (
      distance >= cumulativeDistances[i] &&
      distance < cumulativeDistances[i + 1]
    ) {
      segmentIdx = i;
      break;
    }
  }

  const v1 = vertices[segmentIdx];
  const v2 = vertices[(segmentIdx + 1) % vertices.length];
  const segmentStartDist = cumulativeDistances[segmentIdx];
  const segmentDist = segmentDistances[segmentIdx];
  const distInSegment = distance - segmentStartDist;
  const t = segmentDist > 0 ? distInSegment / segmentDist : 0;

  if (v1.type === "corner" && v2.type === "edge") {
    const arcLength = (Math.PI / 2) * br;
    if (distInSegment < arcLength - EPSILON) {
      const arcT = Math.min(1.0, Math.max(0.0, distInSegment / arcLength));
      return getCornerArcPosition(
        v1.name,
        arcT,
        centerX,
        centerY,
        halfWidth,
        halfHeight,
        br
      );
    } else {
      const cornerEnd = getCornerArcPosition(
        v1.name,
        1.0,
        centerX,
        centerY,
        halfWidth,
        halfHeight,
        br
      );
      const distOnStraight = Math.max(0, distInSegment - arcLength);
      const straightLength = Math.max(EPSILON, segmentDist - arcLength);
      const straightT = Math.min(1.0, Math.max(0.0, distOnStraight / straightLength));
      return {
        x: cornerEnd.x + (v2.x - cornerEnd.x) * straightT,
        y: cornerEnd.y + (v2.y - cornerEnd.y) * straightT,
      };
    }
  } else {
    return {
      x: v1.x + (v2.x - v1.x) * t,
      y: v1.y + (v2.y - v1.y) * t,
    };
  }
}

