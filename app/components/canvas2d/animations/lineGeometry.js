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
        const angleOffset =
          (isClockwise ? 1 : -1) * (Math.PI / 2) * arcProgress;
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
        const angleOffset =
          (isClockwise ? 1 : -1) * (Math.PI / 2) * arcProgress;
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
  const angles = {
    TL: isClockwise ? Math.PI : Math.PI / 2,
    TR: isClockwise ? Math.PI / 2 : 0,
    BR: isClockwise ? 0 : -Math.PI / 2,
    BL: isClockwise ? -Math.PI / 2 : Math.PI,
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
