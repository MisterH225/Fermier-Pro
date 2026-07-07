"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SettingsSectionProps = {
  id?: string;
  icon?: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Contenu sans encadré (listes, tableaux). */
  bare?: boolean;
  className?: string;
};

export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
  footer,
  bare = false,
  className
}: SettingsSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "grid gap-6 border-b border-border/50 pb-10 last:border-b-0 last:pb-0 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] lg:gap-10",
        className
      )}
    >
      <div className="space-y-3 lg:pt-1">
        {Icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted/50">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
        ) : null}
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 space-y-4">
        {bare ? (
          children
        ) : (
          <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            {children}
          </div>
        )}
        {footer ? (
          <div className="flex flex-wrap items-center gap-3">{footer}</div>
        ) : null}
      </div>
    </section>
  );
}

type SettingsSectionSaveFooterProps = {
  saving?: boolean;
  saved?: boolean;
  onSave: () => void;
  saveLabel: string;
  savedLabel: string;
  canEdit?: boolean;
};

export function SettingsSectionSaveFooter({
  saving = false,
  saved = false,
  onSave,
  saveLabel,
  savedLabel,
  canEdit = true
}: SettingsSectionSaveFooterProps) {
  if (!canEdit) {
    return null;
  }
  return (
    <>
      <Button type="button" size="sm" disabled={saving} onClick={onSave}>
        {saving ? "…" : saveLabel}
      </Button>
      {saved ? <Badge variant="success">{savedLabel}</Badge> : null}
    </>
  );
}

export function SettingsGroup({
  title,
  children,
  className
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-10", className)}>
      {title ? (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      ) : null}
      <div className="space-y-10">{children}</div>
    </div>
  );
}
