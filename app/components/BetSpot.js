import { forwardRef } from "react";

const BetSpot = forwardRef(function BetSpot(props, ref) {
  // Simplified component - all glow effects are handled via ref in parent
  return (
    <div
      ref={ref}
      className="relative w-[100px] h-[100px] flex items-center justify-center"
      style={{
        borderRadius: "5px",
        backgroundColor: "#a4242f",
        willChange: "transform, box-shadow, filter, background-color",
      }}
    >
      {/* <span className="text-white text-4xl font-bold">10</span> */}
    </div>
  );
});

export default BetSpot;
