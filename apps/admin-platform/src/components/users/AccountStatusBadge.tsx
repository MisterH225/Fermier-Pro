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
  const variants: Record<AccountStatus, "success" | "warning" | "danger"> = {
    active: "success",
    suspended: "warning",
    banned: "danger"
  };
  const label =
    key === "active" || key === "suspended" || key === "banned"
      ? t(key)
      : status;
  return (
    <Badge
      variant={variants[key as AccountStatus] ?? "outline"}
      className={cn("font-medium", className)}
    >
      {label}
    </Badge>
  );
}
