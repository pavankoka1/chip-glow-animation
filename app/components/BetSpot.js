import { forwardRef } from "react";

const BetSpot = forwardRef(function BetSpot(props, ref) {
  return (
    <div
      ref={ref}
      className="relative w-[200px] h-[200px] bg-[#a4242f] flex items-center justify-center rounded-sm"
    >
      <span className="text-white text-4xl font-bold">10</span>
    </div>
  );
});

export default BetSpot;
