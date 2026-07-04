import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PhoneFrame({
  children,
  className,
  glow = "olive"
}: {
  children: ReactNode;
  className?: string;
  glow?: "olive" | "purple" | "warm";
}) {
  const glowClass = {
    olive: "shadow-[0_32px_80px_rgba(92,107,58,0.28)]",
    purple: "shadow-[0_32px_80px_rgba(124,58,237,0.22)]",
    warm: "shadow-[0_32px_80px_rgba(234,88,12,0.2)]"
  }[glow];

  return (
    <div
      className={cn(
        "relative rounded-[2.75rem] border-[7px] border-[#1a1a1a] bg-[#1a1a1a] p-[7px]",
        glowClass,
        className
      )}
    >
      <div className="absolute left-1/2 top-[10px] z-20 h-[22px] w-[88px] -translate-x-1/2 rounded-full bg-[#1a1a1a]" />
      <div className="overflow-hidden rounded-[2.1rem] bg-[#f4f4f6]">{children}</div>
    </div>
  );
}
