import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props<T extends string> = {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: (id: T) => string;
  size?: "sm" | "default";
};

export function FilterPills<T extends string>({
  items,
  value,
  onChange,
  label,
  size = "sm"
}: Props<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((id) => (
        <Button
          key={id}
          type="button"
          size={size}
          variant={value === id ? "default" : "outline"}
          className={cn(
            "rounded-full",
            size === "sm" && "h-8 px-4 text-xs",
            value !== id && "border-white/70 bg-white/40"
          )}
          onClick={() => onChange(id)}
        >
          {label(id)}
        </Button>
      ))}
    </div>
  );
}
