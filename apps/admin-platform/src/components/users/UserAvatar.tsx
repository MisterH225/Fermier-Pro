import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-brand/15 text-brand",
  "bg-brand-accent/15 text-orange-800",
  "bg-brand-olive/15 text-brand-olive-dark",
  "bg-blue-100 text-blue-800",
  "bg-purple-100 text-purple-800"
];

function colorForSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
  lg: "size-12 text-base"
};

export function UserAvatar({ name, email, avatarUrl, size = "md", className }: Props) {
  const seed = name ?? email ?? "?";
  const initials = (name ?? email ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? email ?? ""}
        className={cn("rounded-full object-cover shrink-0", SIZES[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold shrink-0",
        SIZES[size],
        colorForSeed(seed),
        className
      )}
    >
      {initials || "?"}
    </div>
  );
}
