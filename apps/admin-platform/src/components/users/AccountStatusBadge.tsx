"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AccountStatus } from "@/lib/moderation";

export function AccountStatusBadge({
  status,
  className
}: {
  status: AccountStatus | string;
  className?: string;
}) {
  const t = useTranslations("users.accountStatus");
  const key = status as AccountStatus;
  const styles: Record<AccountStatus, string> = {
    active: "bg-emerald-50 text-emerald-800 border-emerald-200",
    suspended: "bg-amber-50 text-amber-900 border-amber-200",
    banned: "bg-red-50 text-red-800 border-red-200"
  };
  const label =
    key === "active" || key === "suspended" || key === "banned"
      ? t(key)
      : status;
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-lg font-medium",
        styles[key as AccountStatus] ?? "bg-muted",
        className
      )}
    >
      {label}
    </Badge>
  );
}
