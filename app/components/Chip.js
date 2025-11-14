export default function Chip() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[100px] rounded-full bg-gradient-to-br from-amber-200 via-amber-300 to-amber-400 border-4 border-amber-500 shadow-2xl flex items-center justify-center ring-2 ring-amber-600/50">
      <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-50/50 to-transparent absolute inset-0"></div>
      <div className="relative z-10 text-amber-900 font-bold text-lg drop-shadow-md">$5</div>
    </div>
  );
}

