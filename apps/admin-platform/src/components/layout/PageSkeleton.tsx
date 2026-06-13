import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function PageSkeleton({ className }: Props) {
  return (
    <div className={cn("space-y-6 animate-pulse", className)}>
      <div className="h-8 w-48 rounded-2xl bg-white/40 backdrop-blur-sm animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-3xl bg-white/40 backdrop-blur-sm" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-80 rounded-3xl bg-white/40 backdrop-blur-sm" />
        ))}
      </div>
      <div className="h-40 rounded-3xl bg-white/40 backdrop-blur-sm" />
    </div>
  );
}

export function ShellLoading() {
  return (
    <div className="min-h-screen dashboard-bg flex items-center justify-center">
      <div className="size-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    </div>
  );
}
