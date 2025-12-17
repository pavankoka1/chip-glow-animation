import { useEffect, useId, useState } from "react";
import { SvgDefs } from "./BetSpotSvg/SvgDefs";
import { SvgPaths } from "./BetSpotSvg/SvgPaths";
import { calculateSvgDimensions } from "./BetSpotSvg/utils/svgCalculations";

const BetSpotSvg = function BetSpotSvg({ betspotRef, svgRef }) {
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
      if (element && typeof element.getBoundingClientRect === "function") {
        try {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setDimensions({ width: rect.width, height: rect.height });
          }
        } catch (error) {
          // Silently handle errors during SSR or when element is not ready
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
  const svgCalculations = calculateSvgDimensions(width, height);

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
