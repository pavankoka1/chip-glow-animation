import { forwardRef } from "react";

const BetMultiplier = forwardRef(function BetMultiplier({ text = "50x" }, ref) {
  return (
    <div
      ref={ref}
      className="absolute flex items-center justify-center pointer-events-none"
      style={{
        transform: "translate(-50%, -50%) scale(0) translateZ(0)",
        opacity: "0",
        willChange: "transform, opacity",
        zIndex: 100,
        position: "absolute",
        top: "50%",
        left: "50%",
      }}
    >
      <span className="relative inline-block" style={{ lineHeight: 1 }}>
        {/* Border/Stroke layer - behind */}
        <span
          className="text-xl font-extrabold absolute"
          style={{
            left: 0,
            top: 0,
            color: "transparent",
            WebkitTextStroke: "6px #824905",
            textStroke: "6px #824905",
            whiteSpace: "nowrap",
            zIndex: 1,
          }}
        >
          {text}
        </span>
        {/* Gradient fill layer - on top */}
        <span
          className="text-xl font-extrabold relative"
          style={{
            background: "linear-gradient(to bottom, #feeda1, #f2f3ef, #feeda1)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            color: "#feeda1",
            display: "inline-block",
            whiteSpace: "nowrap",
            zIndex: 2,
          }}
        >
          {text}
        </span>
      </span>
    </div>
  );
});

export default BetMultiplier;
