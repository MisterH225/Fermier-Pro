"use client";

import { cn } from "@/lib/utils";

type Props<T extends string> = {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: (id: T) => string;
  className?: string;
  /** @deprecated Conservé pour compatibilité — le style est désormais des onglets soulignés. */
  size?: "sm" | "default";
};

export function FilterPills<T extends string>({
  items,
  value,
  onChange,
  label,
  className
}: Props<T>) {
  return (
    <nav
      className={cn("flex flex-wrap gap-6 border-b border-border/60", className)}
      aria-label="Filtres"
    >
      {items.map((id) => (
        <button
          key={id}
          type="button"
          className={cn(
            "-mb-px border-b-2 pb-3 text-sm font-medium transition-colors",
            value === id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onChange(id)}
        >
          {label(id)}
        </button>
      ))}
    </nav>
  );
}
