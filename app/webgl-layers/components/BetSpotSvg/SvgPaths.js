export function SvgPaths({
  contentOffsetX,
  contentOffsetY,
  width,
  height,
  borderRadius,
  halfStroke,
  borderStrokeWidth,
  borderGlowStrokeWidth,
  rectInset,
  fullBgGradientId,
  borderGradientId,
}) {
  return (
    <>
      <g data-svg-part="background">
        <path
          d={`M${contentOffsetX + borderRadius} ${contentOffsetY} L${
            contentOffsetX + width - borderRadius
          } ${contentOffsetY} Q${contentOffsetX + width} ${contentOffsetY} ${
            contentOffsetX + width
          } ${contentOffsetY + borderRadius} L${contentOffsetX + width} ${
            contentOffsetY + height - borderRadius
          } Q${contentOffsetX + width} ${contentOffsetY + height} ${
            contentOffsetX + width - borderRadius
          } ${contentOffsetY + height} L${contentOffsetX + borderRadius} ${
            contentOffsetY + height
          } Q${contentOffsetX} ${contentOffsetY + height} ${contentOffsetX} ${
            contentOffsetY + height - borderRadius
          } L${contentOffsetX} ${
            contentOffsetY + borderRadius
          } Q${contentOffsetX} ${contentOffsetY} ${
            contentOffsetX + borderRadius
          } ${contentOffsetY} Z`}
          fill={`url(#${fullBgGradientId})`}
        />
      </g>
      <g data-svg-part="border">
        <path
          d={`M${contentOffsetX + halfStroke + borderRadius} ${
            contentOffsetY + halfStroke
          } L${contentOffsetX + width - halfStroke - borderRadius} ${
            contentOffsetY + halfStroke
          } Q${contentOffsetX + width - halfStroke} ${
            contentOffsetY + halfStroke
          } ${contentOffsetX + width - halfStroke} ${
            contentOffsetY + halfStroke + borderRadius
          } L${contentOffsetX + width - halfStroke} ${
            contentOffsetY + height - halfStroke - borderRadius
          } Q${contentOffsetX + width - halfStroke} ${
            contentOffsetY + height - halfStroke
          } ${contentOffsetX + width - halfStroke - borderRadius} ${
            contentOffsetY + height - halfStroke
          } L${contentOffsetX + halfStroke + borderRadius} ${
            contentOffsetY + height - halfStroke
          } Q${contentOffsetX + halfStroke} ${
            contentOffsetY + height - halfStroke
          } ${contentOffsetX + halfStroke} ${
            contentOffsetY + height - halfStroke - borderRadius
          } L${contentOffsetX + halfStroke} ${
            contentOffsetY + halfStroke + borderRadius
          } Q${contentOffsetX + halfStroke} ${contentOffsetY + halfStroke} ${
            contentOffsetX + halfStroke + borderRadius
          } ${contentOffsetY + halfStroke} Z`}
          stroke="#FFE825"
          strokeWidth={borderStrokeWidth}
          fill="none"
        />
      </g>
      <rect
        x={contentOffsetX + rectInset}
        y={contentOffsetY + rectInset}
        width={width - rectInset * 2}
        height={height - rectInset * 2}
        rx={borderRadius}
        ry={borderRadius}
        stroke={`url(#${borderGradientId})`}
        strokeWidth={borderGlowStrokeWidth}
        fill="none"
      />
    </>
  );
}
