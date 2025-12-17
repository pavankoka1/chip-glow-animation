export function calculateSvgDimensions(elementWidth, elementHeight) {
  const originalSvgWidth = 62;
  const originalSvgHeight = 154;

  const borderStrokeWidth = elementWidth * (2.7 / originalSvgWidth);
  const borderGlowStrokeWidth = elementWidth * (0.9 / originalSvgWidth);
  const borderRadius = 6.75;

  const scaleX = elementWidth / originalSvgWidth;
  const scaleY = elementHeight / originalSvgHeight;
  const glowScaleFactor = Math.max(scaleX, scaleY);

  const filledPathStart = 8.66504;
  const filledPathEnd = 51.665;
  const filledPathWidth = filledPathEnd - filledPathStart;
  const rectInsetRatio = (9.11504 - filledPathStart) / filledPathWidth;
  const rectInset = elementWidth * rectInsetRatio;

  const halfStroke = borderStrokeWidth / 2;
  const maxBlur = 4.33242 * glowScaleFactor;
  const glowExtension = Math.ceil(maxBlur * 4);

  const svgTotalWidth = elementWidth + glowExtension * 2;
  const svgTotalHeight = elementHeight + glowExtension * 2;
  const contentOffsetX = glowExtension;
  const contentOffsetY = glowExtension;

  return {
    borderStrokeWidth,
    borderGlowStrokeWidth,
    borderRadius,
    rectInset,
    halfStroke,
    glowExtension,
    svgTotalWidth,
    svgTotalHeight,
    contentOffsetX,
    contentOffsetY,
  };
}
