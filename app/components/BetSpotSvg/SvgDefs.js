export function SvgDefs({
  fullBgGradientId,
  borderGradientId,
  contentOffsetX,
  contentOffsetY,
  width,
  height,
}) {
  return (
    <defs>
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
  );
}
