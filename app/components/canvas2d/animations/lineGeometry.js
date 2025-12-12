function getLinePathPositionByDistance(
  distance,
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  startPointRad,
  direction,
  borderRadius = 5
) {
  const safeHalfWidth = halfWidth || 50;
  const safeHalfHeight = halfHeight || 50;
  const safeBorderRadius = Math.min(
    borderRadius,
    Math.min(safeHalfWidth, safeHalfHeight)
  );

  const width = safeHalfWidth * 2;
  const height = safeHalfHeight * 2;
  // Calculate perimeter with rounded corners
  // Each corner is a quarter circle, so total corner length = 2 * PI * borderRadius
  const cornerLength = 2 * Math.PI * safeBorderRadius;
  const straightEdgesLength = 2 * (width + height) - 8 * safeBorderRadius; // Subtract corner sections
  const perimeter = straightEdgesLength + cornerLength;

  if (perimeter <= 0 || !Number.isFinite(perimeter)) {
    return { x: centerX, y: centerY, angle: 0 };
  }

  let adjustedDistance = distance;
  if (startPointRad !== 0) {
    const startPointFraction = (((startPointRad % 360) + 360) % 360) / 360.0;
    const startDistance = startPointFraction * perimeter;
    adjustedDistance = (startDistance + distance) % perimeter;
  }

  adjustedDistance =
    adjustedDistance < 0 ? adjustedDistance + perimeter : adjustedDistance;
  adjustedDistance = adjustedDistance % perimeter;

  const isClockwise = direction !== "anticlockwise";

  const corners = {
    TL: [-safeHalfWidth, safeHalfHeight],
    TR: [safeHalfWidth, safeHalfHeight],
    BR: [safeHalfWidth, -safeHalfHeight],
    BL: [-safeHalfWidth, -safeHalfHeight],
  };

  // Edge segments with border radius consideration
  const edgeLength = width - 2 * safeBorderRadius;
  const verticalEdgeLength = height - 2 * safeBorderRadius;
  const cornerArcLength = (Math.PI / 2) * safeBorderRadius; // Quarter circle

  const edges = [
    {
      from: "TL",
      to: "TR",
      straightLength: edgeLength,
      cornerStart: "TL",
      cornerEnd: "TR",
      angle: 0,
    },
    {
      from: "TR",
      to: "BR",
      straightLength: verticalEdgeLength,
      cornerStart: "TR",
      cornerEnd: "BR",
      angle: Math.PI / 2,
    },
    {
      from: "BR",
      to: "BL",
      straightLength: edgeLength,
      cornerStart: "BR",
      cornerEnd: "BL",
      angle: Math.PI,
    },
    {
      from: "BL",
      to: "TL",
      straightLength: verticalEdgeLength,
      cornerStart: "BL",
      cornerEnd: "TL",
      angle: -Math.PI / 2,
    },
  ];

  const edgeOrder = [0, 1, 2, 3];
  let remainingDist = adjustedDistance;
  let currentEdgeIdx = 0;
  let edgeCount = 0;

  while (remainingDist >= 0 && edgeCount < 4) {
    const edgeIdx = edgeOrder[currentEdgeIdx % 4];
    const edge = edges[edgeIdx];

    if (!edge) {
      break;
    }

    // Total length of this edge segment (straight + corner at start + corner at end)
    const totalEdgeLength = edge.straightLength + 2 * cornerArcLength;

    if (remainingDist <= totalEdgeLength) {
      let x, y, angle;

      // Check if we're in the first corner
      if (remainingDist < cornerArcLength) {
        // In first corner arc
        const cornerCenter = getCornerCenter(
          edge.cornerStart,
          safeHalfWidth,
          safeHalfHeight,
          safeBorderRadius
        );
        const startAngle = getCornerStartAngle(edge.cornerStart, isClockwise);
        const arcProgress = remainingDist / cornerArcLength;
        // For corners where angle decreases when going clockwise, we need negative offset
        // TL: Math.PI/2 -> 0 (decrease), TR: Math.PI -> Math.PI/2 (decrease), BL: 0 -> -Math.PI/2 (decrease)
        // BR: -Math.PI/2 -> Math.PI (wraps, but arc only goes -Math.PI/2 -> 0, so it's an increase)
        const needsReverse =
          (isClockwise &&
            (edge.cornerStart === "TL" ||
              edge.cornerStart === "TR" ||
              edge.cornerStart === "BL")) ||
          (!isClockwise && edge.cornerStart === "BR");
        const angleOffset = needsReverse
          ? -(Math.PI / 2) * arcProgress
          : (isClockwise ? 1 : -1) * (Math.PI / 2) * arcProgress;
        const currentAngle = startAngle + angleOffset;
        x = cornerCenter.x + safeBorderRadius * Math.cos(currentAngle);
        y = cornerCenter.y + safeBorderRadius * Math.sin(currentAngle);
        angle = currentAngle + (isClockwise ? Math.PI / 2 : -Math.PI / 2);
      } else if (remainingDist < cornerArcLength + edge.straightLength) {
        // In straight section
        const distOnStraight = remainingDist - cornerArcLength;
        const tOnStraight =
          edge.straightLength > 0 ? distOnStraight / edge.straightLength : 0;

        const [fromX, fromY] = getCornerEndPoint(
          edge.cornerStart,
          safeHalfWidth,
          safeHalfHeight,
          safeBorderRadius,
          isClockwise
        );
        const [toX, toY] = getCornerStartPoint(
          edge.cornerEnd,
          safeHalfWidth,
          safeHalfHeight,
          safeBorderRadius,
          isClockwise
        );

        x = fromX + (toX - fromX) * tOnStraight;
        y = fromY + (toY - fromY) * tOnStraight;
        angle = edge.angle;
        if (!isClockwise) angle += Math.PI;
      } else {
        // In second corner arc
        const distInCorner =
          remainingDist - cornerArcLength - edge.straightLength;
        const cornerCenter = getCornerCenter(
          edge.cornerEnd,
          safeHalfWidth,
          safeHalfHeight,
          safeBorderRadius
        );
        const startAngle = getCornerStartAngle(edge.cornerEnd, isClockwise);
        const arcProgress = distInCorner / cornerArcLength;
        // For corners where angle decreases when going clockwise, we need negative offset
        // Same logic as first corner
        const needsReverse =
          (isClockwise &&
            (edge.cornerEnd === "TL" ||
              edge.cornerEnd === "TR" ||
              edge.cornerEnd === "BL")) ||
          (!isClockwise && edge.cornerEnd === "BR");
        const angleOffset = needsReverse
          ? -(Math.PI / 2) * arcProgress
          : (isClockwise ? 1 : -1) * (Math.PI / 2) * arcProgress;
        const currentAngle = startAngle + angleOffset;
        x = cornerCenter.x + safeBorderRadius * Math.cos(currentAngle);
        y = cornerCenter.y + safeBorderRadius * Math.sin(currentAngle);
        angle = currentAngle + (isClockwise ? Math.PI / 2 : -Math.PI / 2);
      }

      const screenX = x + centerX;
      const screenY = -y + centerY;

      return { x: screenX, y: screenY, angle };
    }

    remainingDist -= totalEdgeLength;
    currentEdgeIdx++;
    edgeCount++;
  }

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

  return { x: centerX, y: centerY, angle: 0 };
}

function getCornerCenter(corner, halfWidth, halfHeight, borderRadius) {
  switch (corner) {
    case "TL":
      return { x: -halfWidth + borderRadius, y: halfHeight - borderRadius };
    case "TR":
      return { x: halfWidth - borderRadius, y: halfHeight - borderRadius };
    case "BR":
      return { x: halfWidth - borderRadius, y: -halfHeight + borderRadius };
    case "BL":
      return { x: -halfWidth + borderRadius, y: -halfHeight + borderRadius };
    default:
      return { x: 0, y: 0 };
  }
}

function getCornerStartAngle(corner, isClockwise) {
  // Start angle for each corner when going clockwise
  // For clockwise path: TL->TR->BR->BL->TL
  // Each edge has: cornerStart arc + straight + cornerEnd arc
  // For cornerStart (first corner of edge): we're entering from previous edge
  // For cornerEnd (second corner of edge): we're entering from the straight section

  // Edge 0 (TL->TR): cornerStart=TL enters from BL (bottom), cornerEnd=TR enters from TL (left)
  // Edge 1 (TR->BR): cornerStart=TR enters from TL (left), cornerEnd=BR enters from TR (top, but in screen coords this is "up" which is negative Y, so -Math.PI/2)
  // Edge 2 (BR->BL): cornerStart=BR enters from TR (top/up = -Math.PI/2), cornerEnd=BL enters from BR (right = 0)
  // Edge 3 (BL->TL): cornerStart=BL enters from BR (right = 0), cornerEnd=TL enters from BL (bottom = Math.PI/2)

  // The angle is the direction FROM corner center TO the entry point
  // TL as cornerStart: enter from bottom, angle = Math.PI/2
  // TR as cornerEnd: enter from left (straight section from TL), angle = Math.PI
  // TR as cornerStart: enter from left (from previous edge), angle = Math.PI
  // BR as cornerEnd: enter from top/up (straight section from TR), but "up" in screen coords...
  // Actually, the straight section from TR goes down (Math.PI/2), so at BR corner we enter from the top of the corner, which relative to corner center is... hmm

  // Let me think about BR corner center: it's at (halfWidth-br, -halfHeight+br)
  // The entry point (from TR, going down the right edge) would be at the top of the BR corner
  // Top relative to BR corner center: the corner center is in the bottom-right, so "top" means decreasing Y, which is -Math.PI/2
  // But wait, if we're going down (Math.PI/2), and we reach BR corner, we're at the top of the BR corner
  // The direction from BR corner center to the top of the corner is... up, which is -Math.PI/2

  // Actually, I think the issue is simpler. Let me just use the exit angles and work backwards:
  // For clockwise, the exit angle is startAngle + Math.PI/2 (with positive offset) or startAngle - Math.PI/2 (with negative)
  // TL: exit to right (0), so if we use negative offset: 0 - (-Math.PI/2) = Math.PI/2 (entry from bottom) ✓
  // TR: exit to bottom (Math.PI/2), so if we use negative offset: Math.PI/2 - (-Math.PI/2) = Math.PI (entry from left) ✓
  // BR: exit to left (Math.PI), so if we use positive offset: Math.PI - Math.PI/2 = Math.PI/2 (but that's down, not where we enter)
  // Actually for BR, we enter from the straight section which is coming from TR going down
  // At BR corner, the straight section ends, and we start the corner arc
  // The entry point is at the "top" of BR corner (where the right edge straight section ends)
  // From BR corner center, "top" is -Math.PI/2
  // Exit is to left: Math.PI
  // So we go from -Math.PI/2 to Math.PI, which wraps around

  // Entry angles: direction from corner center to where we enter the corner
  // For clockwise: TL enters from bottom, TR from left, BR from top, BL from right
  const angles = {
    TL: isClockwise ? Math.PI / 2 : Math.PI, // Enter from bottom (Math.PI/2 = down)
    TR: isClockwise ? Math.PI : Math.PI / 2, // Enter from left (Math.PI = left)
    BR: isClockwise ? -Math.PI / 2 : 0, // Enter from top (-Math.PI/2 = up, coming from TR going down, we're at top of BR corner)
    BL: isClockwise ? 0 : -Math.PI / 2, // Enter from right (0 = right)
  };
  return angles[corner] || 0;
}

function getCornerStartPoint(
  corner,
  halfWidth,
  halfHeight,
  borderRadius,
  isClockwise
) {
  const center = getCornerCenter(corner, halfWidth, halfHeight, borderRadius);
  const angle = getCornerStartAngle(corner, isClockwise);
  return [
    center.x + borderRadius * Math.cos(angle),
    center.y + borderRadius * Math.sin(angle),
  ];
}

function getCornerEndPoint(
  corner,
  halfWidth,
  halfHeight,
  borderRadius,
  isClockwise
) {
  const center = getCornerCenter(corner, halfWidth, halfHeight, borderRadius);
  const startAngle = getCornerStartAngle(corner, isClockwise);
  const endAngle = startAngle + (isClockwise ? Math.PI / 2 : -Math.PI / 2);
  return [
    center.x + borderRadius * Math.cos(endAngle),
    center.y + borderRadius * Math.sin(endAngle),
  ];
}

export { getLinePathPositionByDistance };
