'use client';

interface SiteLoaderProps {
  fullScreen?: boolean;
}

export default function SiteLoader({ fullScreen = false }: SiteLoaderProps) {
  const content = (
    <div className="flex flex-col items-center justify-center p-6 text-center select-none">
      {/* Animated 10-Wheeler Dumper & Poclain Excavator Construction Scene */}
      <div className="relative w-64 h-28 flex flex-col items-center justify-end overflow-hidden rounded-2xl bg-gradient-to-b from-amber-500/10 to-slate-900/10 p-2 border border-amber-300/40 shadow-inner">
        {/* Sky / Dust Cloud Background Particles */}
        <div className="absolute top-2 left-3 flex gap-1.5 opacity-60">
          <span className="w-3 h-3 rounded-full bg-amber-300/60 animate-ping" />
          <span className="w-2 h-2 rounded-full bg-amber-400/40 animate-ping delay-150" />
        </div>

        {/* Construction Fleet Vehicles Row */}
        <div className="flex items-end justify-center gap-1 z-10 w-full px-2 mb-1.5">
          {/* Poclain / Excavator (पोकलेन) */}
          <div className="flex flex-col items-center animate-dig-poclain">
            <span className="text-3xl filter drop-shadow-md transform -scale-x-100">
              🚜
            </span>
          </div>

          {/* Falling Gravel Particles */}
          <div className="flex flex-col items-center -mb-1 z-20">
            <span className="text-xs animate-bounce text-amber-700">🪨</span>
            <span className="text-[10px] animate-ping text-amber-600 delay-100">✨</span>
          </div>

          {/* 10-Wheeler Heavy Dumper Truck (10 व्हीलर डम्पर) */}
          <div className="flex flex-col items-center animate-bounce-dumper">
            <span className="text-4xl filter drop-shadow-lg">
              🚛
            </span>
            {/* 10 Wheels Representation Badge */}
            <div className="flex items-center gap-0.5 mt-[-4px] bg-slate-900 text-amber-400 px-1.5 py-0.5 rounded-full text-[8px] font-black border border-amber-400/50 shadow-xs">
              <span>●●●●●</span>
              <span className="text-[7px] text-white">10-W</span>
            </div>
          </div>
        </div>

        {/* Animated Ground / Road Track */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative border border-slate-700">
          <div className="w-[200%] h-full bg-[linear-gradient(90deg,#f59e0b_25%,#1e293b_25%,#1e293b_50%,#f59e0b_50%,#f59e0b_75%,#1e293b_75%)] bg-[length:32px_100%] animate-move-road" />
        </div>
      </div>

      {/* Fleet Badge (No "Loading..." text) */}
      <div className="mt-3 inline-flex items-center gap-2 bg-amber-500 text-slate-950 px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-wider shadow-md border border-amber-400 animate-pulse">
        <span>⚡</span>
        <span>Fleet Operations Active</span>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xs z-50 flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-3xl p-4 shadow-2xl border-2 border-amber-400 max-w-xs w-full">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
