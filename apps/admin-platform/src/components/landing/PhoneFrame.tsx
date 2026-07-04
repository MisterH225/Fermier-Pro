import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const GLOW = {
  olive: "drop-shadow-[0_40px_80px_rgba(92,107,58,0.35)]",
  purple: "drop-shadow-[0_40px_80px_rgba(124,58,237,0.28)]",
  warm: "drop-shadow-[0_40px_80px_rgba(234,88,12,0.25)]",
  neutral: "drop-shadow-[0_40px_90px_rgba(0,0,0,0.45)]"
} as const;

export function PhoneFrame({
  children,
  className,
  model = "iphone",
  glow = "neutral"
}: {
  children: ReactNode;
  className?: string;
  model?: "iphone" | "samsung";
  glow?: keyof typeof GLOW;
}) {
  if (model === "samsung") {
    return (
      <div className={cn("relative mx-auto w-full max-w-[300px]", GLOW[glow], className)}>
        <div
          className="relative rounded-[2.4rem] p-[3px]"
          style={{
            background: "linear-gradient(145deg, #3f3f46 0%, #18181b 40%, #52525b 100%)"
          }}
        >
          <div className="absolute -left-[2px] top-[22%] h-12 w-[3px] rounded-l bg-zinc-600" />
          <div className="absolute -left-[2px] top-[34%] h-16 w-[3px] rounded-l bg-zinc-600" />
          <div className="absolute -right-[2px] top-[28%] h-20 w-[3px] rounded-r bg-zinc-600" />

          <div className="relative overflow-hidden rounded-[2.25rem] bg-black">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center pt-2">
              <div className="size-2.5 rounded-full bg-zinc-900 ring-1 ring-zinc-700" />
            </div>
            <div className="aspect-[9/19.5] overflow-hidden bg-[#f4f4f6]">{children}</div>
            <div className="pointer-events-none absolute inset-0 rounded-[2.25rem] ring-1 ring-inset ring-white/10" />
          </div>
        </div>
        <div
          className="mx-auto mt-3 h-3 w-[55%] rounded-[100%] opacity-25 blur-md"
          style={{ background: "radial-gradient(ellipse, #000 0%, transparent 70%)" }}
        />
      </div>
    );
  }

  return (
    <div className={cn("relative mx-auto w-full max-w-[300px]", GLOW[glow], className)}>
      {/* iPhone 17 Pro — châssis titane */}
      <div
        className="relative rounded-[3rem] p-[4px]"
        style={{
          background:
            "linear-gradient(160deg, #e8e8ed 0%, #a1a1a6 18%, #6e6e73 42%, #d1d1d6 68%, #8e8e93 100%)"
        }}
      >
        {/* Boutons latéraux */}
        <div className="absolute -left-[3px] top-[18%] h-7 w-[3px] rounded-l-sm bg-zinc-500/90" />
        <div className="absolute -left-[3px] top-[26%] h-12 w-[3px] rounded-l-sm bg-zinc-500/90" />
        <div className="absolute -left-[3px] top-[36%] h-12 w-[3px] rounded-l-sm bg-zinc-500/90" />
        <div className="absolute -right-[3px] top-[28%] h-16 w-[3px] rounded-r-sm bg-zinc-500/90" />

        <div className="relative overflow-hidden rounded-[2.85rem] bg-[#0a0a0a] p-[2px]">
          {/* Dynamic Island */}
          <div className="pointer-events-none absolute left-1/2 top-[10px] z-30 h-[26px] w-[72px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            <div className="absolute right-3 top-1/2 size-2 -translate-y-1/2 rounded-full bg-zinc-900 ring-1 ring-zinc-800" />
          </div>

          <div className="aspect-[9/19.5] overflow-hidden rounded-[2.75rem] bg-[#f4f4f6]">
            {children}
          </div>

          {/* Reflets verre */}
          <div className="pointer-events-none absolute inset-0 rounded-[2.85rem] bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-60" />
          <div className="pointer-events-none absolute inset-0 rounded-[2.85rem] ring-1 ring-inset ring-white/15" />
        </div>
      </div>

      {/* Ombre au sol */}
      <div
        className="mx-auto mt-4 h-4 w-[62%] rounded-[100%] opacity-30 blur-lg"
        style={{ background: "radial-gradient(ellipse, #000 0%, transparent 70%)" }}
      />
    </div>
  );
}
