"use client";

import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  action?: React.ReactNode;
};

export function ChartCard({
  title,
  badge,
  children,
  className,
  contentClassName,
  action
}: Props) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <CardTitle className="truncate">{title}</CardTitle>
          {badge ? (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground rounded-full bg-white/70 border border-white/60 px-2.5 py-1">
              {badge}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          <span className="size-8 rounded-xl bg-white/60 border border-white/50 flex items-center justify-center text-muted-foreground">
            <ChevronRight className="size-4" />
          </span>
        </div>
      </CardHeader>
      <CardContent className={cn("pt-2", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
