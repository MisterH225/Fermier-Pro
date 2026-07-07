import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** Pages tableaux / cartes (marketplace, utilisateurs). */
  wide?: boolean;
  className?: string;
};

export function AdminPageShell({ children, wide = false, className }: Props) {
  return (
    <div
      className={cn(
        "mx-auto space-y-10 pb-8",
        wide ? "w-full max-w-none" : "max-w-5xl",
        className
      )}
    >
      {children}
    </div>
  );
}
