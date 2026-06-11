import Image from "next/image";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-primary/15 text-primary",
  "bg-sky-500/15 text-sky-700",
  "bg-indigo-500/15 text-indigo-700"
] as const;

function initials(name: string | null | undefined, email: string | null | undefined) {
  const base = name?.trim() || email?.split("@")[0] || "?";
  return base
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function paletteIndex(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i)) % 997;
  return h % PALETTE.length;
}

type Props = {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base"
};

export function UserAvatar({ name, email, avatarUrl, size = "md", className }: Props) {
  const seed = name ?? email ?? "";
  const color = PALETTE[paletteIndex(seed)];

  if (avatarUrl) {
    const px = size === "lg" ? 56 : size === "md" ? 40 : 32;
    return (
      <Image
        src={avatarUrl}
        alt={name ?? email ?? "Avatar"}
        width={px}
        height={px}
        className={cn("rounded-full object-cover shrink-0", SIZES[size], className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold shrink-0",
        SIZES[size],
        color,
        className
      )}
    >
      {initials(name, email)}
    </span>
  );
}
