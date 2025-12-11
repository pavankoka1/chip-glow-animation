import { forwardRef } from "react";

const BetSpot = forwardRef(function BetSpot(props, ref) {
  const {
    chipGlowIntensity = 0,
    perimeterGlowIntensity = 0,
    glowScale = 1.0,
  } = props;
  const glowColor = "rgba(253, 203, 61, 1)";

  // Calculate glow effects
  // Chip glow: applies to the entire chip surface
  const chipGlowOpacity = chipGlowIntensity;
  // Scale the glow spread with the scale value - makes it look like betspot is scaling
  const chipGlowSpread = 30 * chipGlowIntensity * glowScale; // Glow spread scales with betspot
  const chipGlowBlur = 20 * chipGlowIntensity * glowScale; // Blur radius scales with betspot

  // Perimeter glow: applies around the chip edges
  const perimeterGlowOpacity = perimeterGlowIntensity;
  const perimeterGlowSpread = 15 * perimeterGlowIntensity * glowScale;
  const perimeterGlowBlur = 10 * perimeterGlowIntensity * glowScale;

  // Combine both glows
  const hasChipGlow = chipGlowIntensity > 0;
  const hasPerimeterGlow = perimeterGlowIntensity > 0;

  return (
    <div
      ref={ref}
      className="relative w-[100px] h-[100px] flex items-center justify-center"
      style={{
        borderRadius: "5px",
        // Base chip color with glow overlay
        backgroundColor: hasChipGlow
          ? `rgba(${166 + (253 - 166) * chipGlowOpacity}, ${
              96 + (203 - 96) * chipGlowOpacity
            }, ${37 + (61 - 37) * chipGlowOpacity}, 1)`
          : "#a4242f",
        // Box shadow for chip glow (covers entire chip)
        boxShadow: hasChipGlow
          ? `inset 0 0 ${chipGlowBlur}px ${glowColor.replace(
              "1)",
              `${chipGlowOpacity})`
            )}, 0 0 ${chipGlowSpread}px ${glowColor.replace(
              "1)",
              `${chipGlowOpacity * 0.6})`
            )}`
          : "none",
        // Filter for perimeter glow (around edges)
        filter: hasPerimeterGlow
          ? `drop-shadow(0 0 ${perimeterGlowBlur}px ${glowColor.replace(
              "1)",
              `${perimeterGlowOpacity * 0.8})`
            )})`
          : "none",
        // Smooth scale transformation for the entire chip
        transform: `scale(${glowScale})`,
        transformOrigin: "center center",
      }}
    >
      {/* <span className="text-white text-4xl font-bold">10</span> */}
    </div>
  );
});

export default BetSpot;
