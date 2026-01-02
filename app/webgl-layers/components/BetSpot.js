import { forwardRef } from "react";

const BetSpot = forwardRef(function BetSpot(props, ref) {
  // Simplified component - all glow effects are handled via ref in parent
  return (
    <div
      ref={ref}
      className="relative w-[43px] h-[46px] flex items-center justify-center bg-[#a4242f]"
      style={{
        willChange: "transform",
        transform: "translateZ(0)",
      }}
    >
      {/* <span className="text-white text-4xl font-bold">10</span> */}
    </div>
  );
});

export default BetSpot;

