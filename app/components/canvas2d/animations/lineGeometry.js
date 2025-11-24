function getLinePathPositionByDistance(
  distance,
  centerX,
  centerY,
  halfWidth,
  halfHeight,
  startPointRad,
  direction
) {
  const safeHalfWidth = halfWidth || 50;
  const safeHalfHeight = halfHeight || 50;

  const width = safeHalfWidth * 2;
  const height = safeHalfHeight * 2;
  const perimeter = 2 * (width + height);

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

  const edges = [
    { from: "TL", to: "TR", length: width, angle: 0 },
    { from: "TR", to: "BR", length: height, angle: Math.PI / 2 },
    { from: "BR", to: "BL", length: width, angle: Math.PI },
    { from: "BL", to: "TL", length: height, angle: -Math.PI / 2 },
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

    const [fromX, fromY] = corners[edge.from];
    const [toX, toY] = corners[edge.to];
    const edgeLen = edge.length;

    if (remainingDist <= edgeLen) {
      const tOnEdge = edgeLen > 0 ? remainingDist / edgeLen : 0;

      let startX, startY, endX, endY;
      if (isClockwise) {
        startX = fromX;
        startY = fromY;
        endX = toX;
        endY = toY;
      } else {
        startX = toX;
        startY = toY;
        endX = fromX;
        endY = fromY;
      }

      const x = startX + (endX - startX) * tOnEdge;
      const y = startY + (endY - startY) * tOnEdge;

      let angle = edge.angle;
      if (!isClockwise) angle += Math.PI;

      const screenX = x + centerX;
      const screenY = -y + centerY;

      return { x: screenX, y: screenY, angle };
    }

    remainingDist -= edgeLen;
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

export { getLinePathPositionByDistance };

