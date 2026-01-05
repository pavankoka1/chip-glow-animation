export function calculateSvgDimensions(elementWidth, elementHeight, borderSizePx = null) {
  const originalSvgWidth = 62;
  const originalSvgHeight = 154;

  // Calculate default border size if not provided
  const defaultBorderStrokeWidth = elementWidth * (2.7 / originalSvgWidth);
  const defaultBorderGlowStrokeWidth = elementWidth * (0.9 / originalSvgWidth);
  
  // Use provided borderSize in pixels, or default if not provided
  const borderStrokeWidth = borderSizePx !== null ? borderSizePx : defaultBorderStrokeWidth;
  
  // Calculate ratio to scale other elements proportionally
  const borderSizeRatio = borderStrokeWidth / defaultBorderStrokeWidth;
  const borderGlowStrokeWidth = defaultBorderGlowStrokeWidth * borderSizeRatio;
  
  const borderRadius = 6.75;

  const scaleX = elementWidth / originalSvgWidth;
  const scaleY = elementHeight / originalSvgHeight;
  const glowScaleFactor = Math.max(scaleX, scaleY);

  const filledPathStart = 8.66504;
  const filledPathEnd = 51.665;
  const filledPathWidth = filledPathEnd - filledPathStart;
  const rectInsetRatio = (9.11504 - filledPathStart) / filledPathWidth;
  // Scale rectInset proportionally with border size to keep gradients/textures aligned
  const rectInset = elementWidth * rectInsetRatio * borderSizeRatio;

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

