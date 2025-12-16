import { LINE_SAMPLE_COUNT, MOBILE_LINE_SAMPLE_COUNT } from "../constants";
import { isMobileDevice } from "../mobileOptimization";

export function computeSpinPathLength(centerX, centerY, rect, borderWidth = 0) {
  if (!rect) {
    const fallbackPerimeter = 2 * (200 + 200);
    return {
      pathLength: fallbackPerimeter,
      halfWidth: 100,
      halfHeight: 100,
    };
  }

  // In BetSpotSvg, the border is drawn INSIDE the content area
  // The filled path goes edge-to-edge, and the border stroke is inset by halfStroke
  // So rect.width is already the content width (the filled path width)
  // We don't need to subtract borderWidth because the border is inside, not outside
  const contentWidth = rect.width;
  const contentHeight = rect.height;
  const halfWidth = contentWidth / 2;
  const halfHeight = contentHeight / 2;

  // Calculate perimeter at the border stroke center (inset by half border width)
  // Border stroke center is at: content edge - borderWidth/2
  const borderHalfWidth = halfWidth - borderWidth / 2;
  const borderHalfHeight = halfHeight - borderWidth / 2;
  const perimeter = 2 * (borderHalfWidth * 2 + borderHalfHeight * 2);

  return {
    pathLength: perimeter,
    halfWidth: borderHalfWidth, // Use border center half-width
    halfHeight: borderHalfHeight, // Use border center half-height
  };
}

export function computeSpinMetrics(
  pathConfig,
  globalConfig,
  rect,
  centerX,
  centerY
) {
  // Calculate border width using the same formula as BetSpotSvg
  // BetSpotSvg: borderStrokeWidth = width * (2.7 / originalSvgWidth)
  // where originalSvgWidth = 62
  const originalSvgWidth = 62;
  const borderWidthRatio = 2.7 / originalSvgWidth;
  // Use the actual rect width (element width) to calculate border width
  // This matches how BetSpotSvg calculates it
  const elementWidth = rect?.width ?? 100;
  const borderWidth = elementWidth * borderWidthRatio;

  const pathResult = computeSpinPathLength(centerX, centerY, rect, borderWidth);

  return {
    pathLength: pathResult.pathLength,
    centerX,
    centerY,
    halfWidth: pathResult.halfWidth,
    halfHeight: pathResult.halfHeight,
    isSpin: true,
    rectWidth: rect?.width,
    rectHeight: rect?.height,
    borderWidth, // Store borderWidth in metrics for use in renderSpinToPoints
  };
}

// Calculate 8 vertices around the betspot perimeter
// Vertices are: 4 edge midpoints + 4 corner points (where border radius starts/ends)
function calculateVertices(
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  borderRadius
) {
  const safeBorderRadius = Math.min(
    borderRadius,
    Math.min(halfWidth, halfHeight)
  );
  const w = halfWidth;
  const h = halfHeight;
  const br = safeBorderRadius;

  // Calculate vertices in clockwise order starting from top center
  // 0: Top center
  // 1: Top-right corner start (end of top edge, start of TR corner arc)
  // 2: Right center
  // 3: Bottom-right corner start (end of right edge, start of BR corner arc)
  // 4: Bottom center
  // 5: Bottom-left corner start (end of bottom edge, start of BL corner arc)
  // 6: Left center
  // 7: Top-left corner start (end of left edge, start of TL corner arc)

  // Note: In screen coordinates, Y increases downward
  // So top is negative Y, bottom is positive Y
  const vertices = [
    // 0: Top center
    { x: centerX, y: centerY - h, type: "edge", name: "top" },
    // 1: Top-right corner start (where top edge ends, TR corner arc begins)
    {
      x: centerX + w - br,
      y: centerY - h,
      type: "corner",
      name: "TR",
      side: "start",
    },
    // 2: Right center
    { x: centerX + w, y: centerY, type: "edge", name: "right" },
    // 3: Bottom-right corner start (where right edge ends, BR corner arc begins)
    {
      x: centerX + w,
      y: centerY + h - br,
      type: "corner",
      name: "BR",
      side: "start",
    },
    // 4: Bottom center
    { x: centerX, y: centerY + h, type: "edge", name: "bottom" },
    // 5: Bottom-left corner start (where bottom edge ends, BL corner arc begins)
    {
      x: centerX - w + br,
      y: centerY + h,
      type: "corner",
      name: "BL",
      side: "start",
    },
    // 6: Left center
    { x: centerX - w, y: centerY, type: "edge", name: "left" },
    // 7: Top-left corner start (where left edge ends, TL corner arc begins)
    {
      x: centerX - w,
      y: centerY - h + br,
      type: "corner",
      name: "TL",
      side: "start",
    },
  ];

  return { vertices, borderRadius: br };
}

// Calculate corner arc center and get position along the arc
function getCornerArcPosition(
  cornerName,
  t,
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  borderRadius
) {
  // t is 0 to 1 along the quarter circle arc
  // In screen coordinates: Y increases downward, so angles are:
  // 0 = right, Math.PI/2 = down, Math.PI = left, -Math.PI/2 = up
  const br = borderRadius;
  const w = halfWidth;
  const h = halfHeight;

  let cornerCenter;
  let startAngle;

  switch (cornerName) {
    case "TL":
      // Top-left corner: arc from left edge to top edge (clockwise)
      cornerCenter = { x: centerX - w + br, y: centerY - h + br };
      // Entry point: left side of corner (x = centerX - w, y = centerY - h + br)
      // Exit point: top side of corner (x = centerX - w + br, y = centerY - h)
      // From corner center, entry is at angle Math.PI (left), exit is at -Math.PI/2 (up)
      // For clockwise: Math.PI -> Math.PI + Math.PI/2 = 3*Math.PI/2, then normalize to -Math.PI/2
      // We travel Math.PI/2 radians clockwise
      startAngle = Math.PI;
      let angleTL = startAngle + (Math.PI / 2) * t;
      // Normalize to [-Math.PI, Math.PI] range
      while (angleTL > Math.PI) angleTL -= 2 * Math.PI;
      while (angleTL < -Math.PI) angleTL += 2 * Math.PI;
      return {
        x: cornerCenter.x + br * Math.cos(angleTL),
        y: cornerCenter.y + br * Math.sin(angleTL),
      };
    case "TR":
      // Top-right corner: arc from top edge to right edge (clockwise)
      cornerCenter = { x: centerX + w - br, y: centerY - h + br };
      // Entry: top side (x = centerX + w - br, y = centerY - h)
      // Exit: right side (x = centerX + w, y = centerY - h + br)
      // From center: entry at -Math.PI/2 (up), exit at 0 (right)
      startAngle = -Math.PI / 2;
      const angleTR = startAngle + (Math.PI / 2) * t;
      return {
        x: cornerCenter.x + br * Math.cos(angleTR),
        y: cornerCenter.y + br * Math.sin(angleTR),
      };
    case "BR":
      // Bottom-right corner: arc from right edge to bottom edge (clockwise)
      cornerCenter = { x: centerX + w - br, y: centerY + h - br };
      // Entry: right side (x = centerX + w, y = centerY + h - br)
      // Exit: bottom side (x = centerX + w - br, y = centerY + h)
      // From center: entry at 0 (right), exit at Math.PI/2 (down)
      startAngle = 0;
      const angleBR = startAngle + (Math.PI / 2) * t;
      return {
        x: cornerCenter.x + br * Math.cos(angleBR),
        y: cornerCenter.y + br * Math.sin(angleBR),
      };
    case "BL":
      // Bottom-left corner: arc from bottom edge to left edge (clockwise)
      cornerCenter = { x: centerX - w + br, y: centerY + h - br };
      // Entry: bottom side (x = centerX - w + br, y = centerY + h)
      // Exit: left side (x = centerX - w, y = centerY + h - br)
      // From center: entry at Math.PI/2 (down), exit at Math.PI (left)
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

// Get position along a segment between two vertices
function getPositionOnSegment(
  v1,
  v2,
  t,
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  borderRadius
) {
  // t is 0 to 1 along the segment
  if (v1.type === "corner" && v2.type === "corner" && v1.name === v2.name) {
    // This shouldn't happen - corners are single vertices
    // Linear interpolation as fallback
    return {
      x: v1.x + (v2.x - v1.x) * t,
      y: v1.y + (v2.y - v1.y) * t,
    };
  } else if (v1.type === "corner" && v2.type === "edge") {
    // Coming from a corner, going to an edge
    // Check if we need to complete the corner arc first
    const cornerName = v1.name;
    // The corner arc ends where the edge starts
    // For now, use linear interpolation - the corner arc should be handled separately
    return {
      x: v1.x + (v2.x - v1.x) * t,
      y: v1.y + (v2.y - v1.y) * t,
    };
  } else if (v1.type === "edge" && v2.type === "corner") {
    // Coming from an edge, going to a corner
    // First part is straight, then corner arc
    // For simplicity, use linear for now - we'll handle corner arcs in the main loop
    return {
      x: v1.x + (v2.x - v1.x) * t,
      y: v1.y + (v2.y - v1.y) * t,
    };
  } else {
    // Straight edge segment
    return {
      x: v1.x + (v2.x - v1.x) * t,
      y: v1.y + (v2.y - v1.y) * t,
    };
  }
}

// Calculate distance of a segment
function calculateSegmentDistance(v1, v2, borderRadius) {
  if (v1.type === "edge" && v2.type === "edge") {
    // Straight edge segment
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    return Math.sqrt(dx * dx + dy * dy);
  } else if (v1.type === "corner" && v2.type === "edge") {
    // Corner arc + straight edge
    // The corner arc is a quarter circle
    const arcLength = (Math.PI / 2) * borderRadius;
    // Plus the straight edge from corner end to next vertex
    // For now, approximate - we'll calculate properly
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const straightLength = Math.sqrt(dx * dx + dy * dy);
    return arcLength + straightLength;
  } else if (v1.type === "edge" && v2.type === "corner") {
    // Straight edge to corner start
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    return Math.sqrt(dx * dx + dy * dy);
  } else {
    // Default: straight line
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

export function renderSpinToPoints(
  pointsArray,
  pathConfig,
  globalConfig,
  metrics,
  normalizedTime,
  alpha,
  headRadius,
  tailRadius,
  sparkColorRgb,
  glowColorRgb,
  glowRadius
) {
  const centerX = metrics.centerX;
  const centerY = metrics.centerY;
  const halfWidth = metrics.halfWidth ?? 50;
  const halfHeight = metrics.halfHeight ?? 50;

  // Get border width from metrics (calculated in computeSpinMetrics)
  // or calculate it if not available
  const borderWidth =
    metrics.borderWidth ??
    (metrics.rectWidth ? metrics.rectWidth * (2.7 / 62) : 2.7);

  // Head radius should match the border stroke radius (borderWidth/2), tail radius = 0
  // Since the code uses headWidth/2 as the radius, we need headWidth = borderWidth
  // This ensures the line head radius equals the border stroke radius (borderWidth/2)
  const headWidth = borderWidth;
  const tailWidth = 0;

  const borderRadius = pathConfig.borderRadius ?? 6.75;
  const headColorHex = pathConfig.headColor ?? "#ffeecc";
  const tailColorHex = pathConfig.tailColor ?? "#fcbb60";

  // Position lines exactly on the border path
  // In computeSpinPathLength, we already calculated halfWidth and halfHeight
  // at the border stroke center (inset by borderWidth/2 from content edge)
  // So we can use them directly - no additional adjustment needed
  const adjustedHalfWidth = halfWidth;
  const adjustedHalfHeight = halfHeight;

  // Calculate 8 vertices around the perimeter (offset outward)
  const { vertices, borderRadius: safeBorderRadius } = calculateVertices(
    centerX,
    centerY,
    adjustedHalfWidth,
    adjustedHalfHeight,
    borderRadius
  );

  // Calculate segment distances and cumulative distances
  const segmentDistances = [];
  const cumulativeDistances = [0];
  let totalPerimeter = 0;

  for (let i = 0; i < vertices.length; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % vertices.length];

    let segmentDist = 0;

    if (v1.type === "edge" && v2.type === "corner") {
      // Edge to corner: straight line to corner start point
      const dx = v2.x - v1.x;
      const dy = v2.y - v1.y;
      segmentDist = Math.sqrt(dx * dx + dy * dy);
    } else if (v1.type === "corner" && v2.type === "edge") {
      // Corner to edge: corner arc + straight line
      const arcLength = (Math.PI / 2) * safeBorderRadius;
      // Get corner end point (where arc ends and straight edge to next vertex starts)
      const cornerEnd = getCornerArcPosition(
        v1.name,
        1.0,
        centerX,
        centerY,
        adjustedHalfWidth,
        adjustedHalfHeight,
        safeBorderRadius
      );
      // Calculate distance from corner arc end to next vertex
      const dx = v2.x - cornerEnd.x;
      const dy = v2.y - cornerEnd.y;
      const straightLength = Math.sqrt(dx * dx + dy * dy);
      segmentDist = arcLength + straightLength;

      // Verify corner end point is reasonable (debug)
      // The corner arc should end where the straight edge to the next vertex begins
    } else {
      // Edge to edge (shouldn't happen with 8 vertices, but handle it)
      const dx = v2.x - v1.x;
      const dy = v2.y - v1.y;
      segmentDist = Math.sqrt(dx * dx + dy * dy);
    }

    segmentDistances.push(segmentDist);
    totalPerimeter += segmentDist;
    cumulativeDistances.push(totalPerimeter);
  }

  // Line length equals betspot width
  const width = halfWidth * 2;
  const lineLength = width;

  // Number of rotations (12 full rounds)
  const rotations = 12;
  const totalTravelDistance = rotations * totalPerimeter;
  const travelDistance = totalTravelDistance * normalizedTime;

  // Convert hex colors to RGB (0-1 range)
  const hexToRgb01 = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [1, 1, 1];
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
    ];
  };

  const headColor = hexToRgb01(headColorHex);
  const tailColor = hexToRgb01(tailColorHex);

  // Two lines: one starting from top center (vertex 0), other from bottom center (vertex 4)
  // They should always be opposite (180 degrees apart = half perimeter)
  // Both lines travel at the same speed using the same travelDistance
  const halfPerimeter = totalPerimeter / 2;
  const startDistances = [
    cumulativeDistances[0], // Top center
    cumulativeDistances[4], // Bottom center (should be ~half perimeter from top)
  ];

  // Ensure lines are exactly opposite (180 degrees apart)
  // Line 0 starts at top center (vertex 0)
  // Line 1 should start exactly half perimeter away
  const baseStartDistance0 = startDistances[0];
  const baseStartDistance1 =
    (baseStartDistance0 + halfPerimeter) % totalPerimeter;

  for (let lineIndex = 0; lineIndex < 2; lineIndex++) {
    // Both lines rotate clockwise (same direction)
    // They start 180 degrees apart and maintain that separation
    const baseStartDistance =
      lineIndex === 0 ? baseStartDistance0 : baseStartDistance1;

    // Both lines move forward (clockwise) at the same speed
    const lineStartDistance = baseStartDistance + travelDistance;
    const lineEndDistance = lineStartDistance + lineLength;

    // Normalize distances to [0, totalPerimeter)
    const normalizeDistance = (dist) => {
      let normalized = dist % totalPerimeter;
      if (normalized < 0) normalized += totalPerimeter;
      return normalized;
    };

    const actualStartDist = normalizeDistance(lineStartDistance);
    const actualEndDist = normalizeDistance(lineEndDistance);

    // Check if line wraps around
    const wrapped =
      lineEndDistance > totalPerimeter && actualEndDist < actualStartDist;

    const points = [];
    const lineSampleCount = isMobileDevice()
      ? MOBILE_LINE_SAMPLE_COUNT
      : LINE_SAMPLE_COUNT;

    if (wrapped) {
      // Line wraps around - split into two parts
      const firstPartLength = totalPerimeter - actualStartDist;
      const secondPartLength = actualEndDist;
      const totalLength = firstPartLength + secondPartLength;

      if (totalLength > 0) {
        const firstPartSamples = Math.max(
          1,
          Math.floor(lineSampleCount * (firstPartLength / totalLength))
        );
        const secondPartSamples = Math.max(
          1,
          Math.floor(lineSampleCount * (secondPartLength / totalLength))
        );

        // First part: from start to end of perimeter
        for (let i = 0; i <= firstPartSamples; i++) {
          const t = firstPartSamples > 0 ? i / firstPartSamples : 0;
          // Don't go all the way to totalPerimeter to avoid duplicate at boundary
          const clampedT = i === firstPartSamples ? 0.999 : t;
          const distance = actualStartDist + firstPartLength * clampedT;
          const pos = getPositionFromDistance(
            distance,
            vertices,
            segmentDistances,
            cumulativeDistances,
            centerX,
            centerY,
            adjustedHalfWidth,
            adjustedHalfHeight,
            safeBorderRadius
          );
          if (pos) points.push(pos);
        }

        // Second part: from start of perimeter to end
        // Start from a small offset to avoid duplicate at boundary (distance 0)
        for (let i = 0; i <= secondPartSamples; i++) {
          const t = secondPartSamples > 0 ? i / secondPartSamples : 0;
          // Skip exactly distance 0 to avoid duplicate
          const offsetT = i === 0 ? 0.001 : t;
          const distance = secondPartLength * offsetT;
          const pos = getPositionFromDistance(
            distance,
            vertices,
            segmentDistances,
            cumulativeDistances,
            centerX,
            centerY,
            adjustedHalfWidth,
            adjustedHalfHeight,
            safeBorderRadius
          );
          if (pos) points.push(pos);
        }
      }
    } else {
      // Line doesn't wrap
      for (let i = 0; i <= lineSampleCount; i++) {
        const t = lineSampleCount > 0 ? i / lineSampleCount : 0;
        const distanceAlongLine = lineLength * t;
        const distance = actualStartDist + distanceAlongLine;
        const normalizedDist = normalizeDistance(distance);
        const pos = getPositionFromDistance(
          normalizedDist,
          vertices,
          segmentDistances,
          cumulativeDistances,
          centerX,
          centerY,
          adjustedHalfWidth,
          adjustedHalfHeight,
          safeBorderRadius
        );
        if (pos) points.push(pos);
      }
    }

    if (points.length < 1) {
      continue;
    }

    // Increase sample count for better line texture
    const minPoints = Math.max(points.length, 50);
    const enhancedPoints = [];

    // Interpolate additional points for smoother line
    if (points.length > 1) {
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const segments = Math.max(2, Math.ceil(minPoints / points.length));

        for (let j = 0; j < segments; j++) {
          const t = j / segments;
          enhancedPoints.push({
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t,
          });
        }
      }
      // Add last point
      enhancedPoints.push({
        x: points[points.length - 1].x,
        y: points[points.length - 1].y,
      });
    } else {
      enhancedPoints.push({
        x: points[0].x,
        y: points[0].y,
      });
    }

    // Add points with gradient color and width
    // Head is the leading edge (at the end, going forward), tail is trailing (at the start)
    // Points are ordered from start (tail) to end (head)

    // Calculate cumulative distances along the line for accurate gradient interpolation
    const lineDistances = [];
    let cumulativeLineDist = 0;
    for (let i = 0; i < enhancedPoints.length; i++) {
      if (i === 0) {
        lineDistances.push(0);
      } else {
        const prevPoint = enhancedPoints[i - 1];
        const currPoint = enhancedPoints[i];
        const dx = currPoint.x - prevPoint.x;
        const dy = currPoint.y - prevPoint.y;
        const segmentDist = Math.sqrt(dx * dx + dy * dy);
        cumulativeLineDist += segmentDist;
        lineDistances.push(cumulativeLineDist);
      }
    }
    const totalLineLength = cumulativeLineDist;

    for (let i = 0; i < enhancedPoints.length; i++) {
      const point = enhancedPoints[i];
      // Calculate t based on distance along the line (0 = tail, 1 = head)
      // This ensures smooth gradient even if points are not evenly spaced
      const t = totalLineLength > 0 ? lineDistances[i] / totalLineLength : 0;

      // Interpolate color from tail (t=0, trailing) to head (t=1, leading)
      const r = tailColor[0] + (headColor[0] - tailColor[0]) * t;
      const g = tailColor[1] + (headColor[1] - tailColor[1]) * t;
      const b = tailColor[2] + (headColor[2] - tailColor[2]) * t;

      // Interpolate radius from tail width (t=0) to head width (t=1)
      // This creates a smooth gradual transition
      const pointRadiusAtT =
        tailWidth / 2 + (headWidth / 2 - tailWidth / 2) * t;

      pointsArray.push({
        x: point.x,
        y: point.y,
        radius: pointRadiusAtT,
        sparkColor: [r, g, b],
        glowColor: glowColorRgb,
        alpha,
        glowRadius,
      });
    }

    // Add rounded cap at head (leading edge - last point)
    if (enhancedPoints.length > 1) {
      const headPoint = enhancedPoints[enhancedPoints.length - 1];
      const prevPoint = enhancedPoints[enhancedPoints.length - 2];
      // Calculate direction vector from prev to head
      const dx = headPoint.x - prevPoint.x;
      const dy = headPoint.y - prevPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const dirX = dx / dist;
        const dirY = dy / dist;
        const headRadius = headWidth / 2;
        // Add a rounded cap point slightly ahead of the head
        const capOffset = headRadius * 0.8;
        pointsArray.push({
          x: headPoint.x + dirX * capOffset,
          y: headPoint.y + dirY * capOffset,
          radius: headRadius,
          sparkColor: headColor,
          glowColor: glowColorRgb,
          alpha,
          glowRadius,
        });
      }
    }

    // Add rounded cap at tail (trailing edge - first point)
    if (enhancedPoints.length > 1) {
      const tailPoint = enhancedPoints[0];
      const nextPoint = enhancedPoints[1];
      // Calculate direction vector from tail to next
      const dx = nextPoint.x - tailPoint.x;
      const dy = nextPoint.y - tailPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const dirX = dx / dist;
        const dirY = dy / dist;
        const tailRadius = tailWidth / 2;
        // Add a rounded cap point slightly behind the tail
        const capOffset = tailRadius * 0.8;
        pointsArray.push({
          x: tailPoint.x - dirX * capOffset,
          y: tailPoint.y - dirY * capOffset,
          radius: tailRadius,
          sparkColor: tailColor,
          glowColor: glowColorRgb,
          alpha,
          glowRadius,
        });
      }
    }
  }
}

// Get position from distance along the perimeter
function getPositionFromDistance(
  distance,
  vertices,
  segmentDistances,
  cumulativeDistances,
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  borderRadius
) {
  // Find which segment this distance falls into
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
    // Corner arc + straight edge segment
    const arcLength = (Math.PI / 2) * borderRadius;
    const EPSILON = 0.001; // Slightly larger epsilon to avoid boundary issues

    if (distInSegment < arcLength - EPSILON) {
      // On the corner arc
      const arcT = Math.min(1.0, Math.max(0.0, distInSegment / arcLength));
      return getCornerArcPosition(
        v1.name,
        arcT,
        centerX,
        centerY,
        halfWidth,
        halfHeight,
        borderRadius
      );
    } else {
      // On the straight edge after the corner
      const cornerEnd = getCornerArcPosition(
        v1.name,
        1.0,
        centerX,
        centerY,
        halfWidth,
        halfHeight,
        borderRadius
      );
      const distOnStraight = Math.max(0, distInSegment - arcLength);
      const straightLength = Math.max(EPSILON, segmentDist - arcLength);
      const straightT = Math.min(
        1.0,
        Math.max(0.0, distOnStraight / straightLength)
      );
      return {
        x: cornerEnd.x + (v2.x - cornerEnd.x) * straightT,
        y: cornerEnd.y + (v2.y - cornerEnd.y) * straightT,
      };
    }
  } else if (v1.type === "edge" && v2.type === "corner") {
    // Straight edge to corner - this should be handled as straight only
    // The corner arc will be handled in the next segment
    return {
      x: v1.x + (v2.x - v1.x) * t,
      y: v1.y + (v2.y - v1.y) * t,
    };
  } else {
    // Straight edge segment
    return {
      x: v1.x + (v2.x - v1.x) * t,
      y: v1.y + (v2.y - v1.y) * t,
    };
  }
}
