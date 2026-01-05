import { useEffect, useId, useState } from "react";
import { SvgDefs } from "./SvgDefs";
import { SvgPaths } from "./SvgPaths";
import { calculateSvgDimensions } from "./utils/svgCalculations";

const BetSpotSvg = function BetSpotSvg({ betspotRef, svgRef, borderSize = null }) {
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 });

  const baseId = useId();
  const fullBgGradientId = `betspot_full_bg_${baseId}`;
  const borderGradientId = `betspot_border_${baseId}`;

  useEffect(() => {
    const element = betspotRef?.current || betspotRef;
    if (!element) return;

    if (typeof element.getBoundingClientRect !== "function") {
      return;
    }

    const updateDimensions = () => {
      if (element) {
        try {
          const width = element.offsetWidth || 0;
          const height = element.offsetHeight || 0;

          if (width > 0 && height > 0) {
            setDimensions({ width, height });
          }
        } catch (error) {
          // Silently handle errors
        }
      }
    };

    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        updateDimensions();
      });
    }

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
  const svgCalculations = calculateSvgDimensions(width, height, borderSize);

  return (
    <svg
      ref={svgRef}
      width={svgCalculations.svgTotalWidth}
      height={svgCalculations.svgTotalHeight}
      viewBox={`0 0 ${svgCalculations.svgTotalWidth} ${svgCalculations.svgTotalHeight}`}
      style={{
        position: "absolute",
        top: -svgCalculations.glowExtension,
        left: -svgCalculations.glowExtension,
        width: `${svgCalculations.svgTotalWidth}px`,
        height: `${svgCalculations.svgTotalHeight}px`,
        pointerEvents: "none",
        willChange: "transform, opacity",
        overflow: "visible",
        opacity: 0,
        visibility: "hidden",
        transform: "scale(1) translateZ(0)",
        transformOrigin: "center center",
      }}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <SvgDefs
        fullBgGradientId={fullBgGradientId}
        borderGradientId={borderGradientId}
        contentOffsetX={svgCalculations.contentOffsetX}
        contentOffsetY={svgCalculations.contentOffsetY}
        width={width}
        height={height}
      />
      <SvgPaths
        contentOffsetX={svgCalculations.contentOffsetX}
        contentOffsetY={svgCalculations.contentOffsetY}
        width={width}
        height={height}
        borderRadius={svgCalculations.borderRadius}
        halfStroke={svgCalculations.halfStroke}
        borderStrokeWidth={svgCalculations.borderStrokeWidth}
        borderGlowStrokeWidth={svgCalculations.borderGlowStrokeWidth}
        rectInset={svgCalculations.rectInset}
        fullBgGradientId={fullBgGradientId}
        borderGradientId={borderGradientId}
      />
    </svg>
  );
};

export default BetSpotSvg;

