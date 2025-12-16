import { useEffect, useId, useState } from "react";

const BetSpotSvg = function BetSpotSvg({ betspotRef, svgRef }) {
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 });

  // Generate stable unique IDs using useId (SSR-safe, consistent between server and client)
  const baseId = useId();
  const filterId = `betspot_glow_${baseId}`;
  const fullBgGradientId = `betspot_full_bg_${baseId}`;
  const borderGradientId = `betspot_border_${baseId}`;

  // Get dimensions from BetSpot element
  useEffect(() => {
    // Handle both ref object and direct element
    const element = betspotRef?.current || betspotRef;
    if (!element) return;

    // Ensure element is a DOM element with getBoundingClientRect
    if (typeof element.getBoundingClientRect !== "function") {
      return;
    }

    const updateDimensions = () => {
      if (element && typeof element.getBoundingClientRect === "function") {
        try {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setDimensions({ width: rect.width, height: rect.height });
          }
        } catch (error) {
          // Silently handle errors during SSR or when element is not ready
          // Silently handle errors during SSR or when element is not ready
        }
      }
    };

    // Initial measurement - only on client side
    if (typeof window !== "undefined") {
      // Use requestAnimationFrame to ensure element is mounted
      requestAnimationFrame(() => {
        updateDimensions();
      });
    }

    // Watch for resize - only on client side
    if (
      typeof window !== "undefined" &&
      typeof ResizeObserver !== "undefined"
    ) {
      const resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(element);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [betspotRef]);

  const { width, height } = dimensions;

  // Original SVG dimensions for reference
  const originalSvgWidth = 62;
  const originalSvgHeight = 154;

  // Border stroke width scales linearly with width
  // Original: 2.7px border for 62px width = 2.7/62 = 0.043548 ratio
  const borderStrokeWidth = width * (2.7 / originalSvgWidth);

  // Border glow stroke width scales linearly with width
  // Original: 0.9px border for 62px width = 0.9/62 = 0.014516 ratio
  const borderGlowStrokeWidth = width * (0.9 / originalSvgWidth);

  // Border radius is fixed to match original SVG (6.75px)
  // This ensures the SVG border radius stays consistent regardless of BetSpot size
  const borderRadius = 6.75;

  // Calculate scale factors for X and Y separately for other calculations
  const scaleX = width / originalSvgWidth;
  const scaleY = height / originalSvgHeight;

  // Glow blur should scale with both width and height
  // Use the larger scale factor to ensure glow is visible on larger BetSpots
  // This ensures glow radius increases proportionally with BetSpot size
  const glowScaleFactor = Math.max(scaleX, scaleY);

  // Calculate inset values based on original SVG structure
  // Original SVG viewBox: "0 0 61 64"
  // Filled path: starts at 8.66504, ends at 51.665 (actual content width ~43)
  // Stroke path: starts at 15.8652, ends at 50.3154 (inset from filled path)
  // The stroke path is INSIDE the filled path
  // Calculate the inset ratio: (15.8652 - 8.66504) / (51.665 - 8.66504) = 7.2 / 43 = 0.167
  // This means the stroke is inset by ~16.7% from the filled path edges
  const filledPathStart = 8.66504;
  const filledPathEnd = 51.665;
  const filledPathWidth = filledPathEnd - filledPathStart;

  // Original SVG: rect starts at 9.11504 (slightly inset from filled path start)
  // Rect is positioned between filled path and stroke path
  const rectInsetRatio = (9.11504 - filledPathStart) / filledPathWidth;
  const rectInset = width * rectInsetRatio;

  // Half stroke width - used to inset the stroke path so it stays inside BetSpot
  // When a stroke is applied, half goes outside and half inside the path
  // To keep the stroke completely inside, we need to inset by half the stroke width
  const halfStroke = borderStrokeWidth / 2;

  // Calculate glow extension for viewBox (to include glow area outside BetSpot)
  // Blur can extend ~3-4x stdDeviation, so we need enough space
  const maxBlur = 4.33242 * glowScaleFactor;
  const glowExtension = Math.ceil(maxBlur * 4); // 4x for safety margin

  // Total SVG dimensions including glow
  const svgTotalWidth = width + glowExtension * 2;
  const svgTotalHeight = height + glowExtension * 2;

  // Position offset to center BetSpot content within extended SVG
  // The BetSpot content (width x height) should be centered in the extended SVG
  const contentOffsetX = glowExtension;
  const contentOffsetY = glowExtension;

  return (
    <svg
      ref={svgRef}
      width={svgTotalWidth}
      height={svgTotalHeight}
      viewBox={`0 0 ${svgTotalWidth} ${svgTotalHeight}`}
      style={{
        position: "absolute",
        top: -glowExtension,
        left: -glowExtension,
        width: `${svgTotalWidth}px`,
        height: `${svgTotalHeight}px`,
        pointerEvents: "none",
        willChange: "transform, opacity",
        overflow: "visible",
        opacity: 0, // Start at 0, will be updated via DOM manipulation
        transform: "scale(1)", // Start at 1, will be updated via DOM manipulation
        transformOrigin: "center center",
      }}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <defs>
        {/* Full area background radial gradient - covers entire SVG */}
        <radialGradient
          id={fullBgGradientId}
          cx="0.5"
          cy="0.5"
          r="0.5"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0%" stopColor="#834F03" />
          <stop offset="40.8232%" stopColor="#9C6004" />
          <stop offset="100%" stopColor="#CE9404" />
        </radialGradient>

        {/* Filter with extended bounds to allow glow outside - matches original SVG */}
        {/* Original filter bounds: x="0.000198364" y="-4.57764e-05" width="61.3297" height="153.33" */}
        {/* Filter bounds cover the BetSpot content area plus glow extension */}
        <filter
          id={filterId}
          x={`${contentOffsetX - glowExtension * 0.5}`}
          y={`${contentOffsetY - glowExtension * 0.5}`}
          width={width + glowExtension}
          height={height + glowExtension}
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset />
          <feGaussianBlur stdDeviation={`${4.33242 * glowScaleFactor}`} />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 1 0 0 0 0 0.734901 0 0 0 0 0.00587816 0 0 0 1 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow"
          />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset />
          <feGaussianBlur stdDeviation={`${1.1502 * glowScaleFactor}`} />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0"
          />
          <feBlend
            mode="normal"
            in2="effect1_dropShadow"
            result="effect2_dropShadow"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect2_dropShadow"
            result="shape"
          />
        </filter>
        {/* Border linear gradient - matches original SVG pattern */}
        {/* Original: x1="8.66504" y1="15.4295" x2="57.1714" y2="39.5179" */}
        {/* Original viewBox: "0 0 61 64", filled path: 8.66504 to 51.665 (width = 43) */}
        {/* Gradient spans from 8.66504 to 57.1714, which is 48.5064 units */}
        {/* Relative to filled path width (43), gradient extends: 48.5064 / 43 = 1.128 */}
        {/* But we want it to stay within BetSpot bounds, so we'll cap it at width */}
        <linearGradient
          id={borderGradientId}
          x1={contentOffsetX}
          y1={contentOffsetY + height * (15.4295 / 64)}
          x2={contentOffsetX + width}
          y2={contentOffsetY + height * (39.5179 / 64)}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" />
          <stop offset="0.206473" stopColor="#FFF065" />
          <stop offset="0.400799" stopColor="#D4A40B" />
          <stop offset="0.495702" stopColor="#C89B0D" />
          <stop offset="0.571136" stopColor="#D4A40B" />
          <stop offset="0.823825" stopColor="#FFEE69" />
          <stop offset="0.95" stopColor="#FFF6B3" />
          <stop offset="0.977808" stopColor="white" />
        </linearGradient>
      </defs>

      {/* Border group with glow filter - covers full BetSpot */}
      {/* The filter creates glow around both the filled shape and the border stroke */}
      {/* Structure matches original SVG: filter applied to group containing filled path and stroke */}
      <g filter={`url(#${filterId})`}>
        {/* Filled background path - edge to edge of BetSpot, gets the glow effect */}
        {/* Path coordinates use contentOffset to position BetSpot content in center of extended SVG */}
        {/* This should go from edge to edge (0 to width, 0 to height in content coordinates) */}
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
        {/* Border stroke path - inside BetSpot, inset by half stroke width to keep it inside */}
        {/* Inset by half the stroke width so the stroke stays completely inside the BetSpot */}
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
      {/* Border glow rect - positioned between filled path and stroke path */}
      {/* Original: rect starts at 9.11504 (slightly inset from filled path at 8.66504) */}
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
    </svg>
  );
};

export default BetSpotSvg;
