"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  disableFeatureFlag,
  fetchAdminFeatureFlags,
  previewDisableFeatureFlag,
  reactivateFeatureFlag,
  type AdminPlatformModuleDto,
  type FeatureFlagDisablePreviewDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ModulesSettingsPanel() {
  const t = useTranslations("modules");
  const { token, ready } = useAdminToken();
  const [modules, setModules] = useState<AdminPlatformModuleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminPlatformModuleDto | null>(null);
  const [preview, setPreview] = useState<FeatureFlagDisablePreviewDto | null>(null);
  const [reason, setReason] = useState("");
  const [userMessageFr, setUserMessageFr] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"disable" | "reactivate" | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const rows = await fetchAdminFeatureFlags(token);
      setModules(rows);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDisable = async (mod: AdminPlatformModuleDto) => {
    if (!token) return;
    setSelected(mod);
    setMode("disable");
    setReason("");
    setUserMessageFr("");
    const p = await previewDisableFeatureFlag(token, mod.moduleId);
    setPreview(p);
  };

  const openReactivate = (mod: AdminPlatformModuleDto) => {
    setSelected(mod);
    setMode("reactivate");
    setReason("");
    setPreview(null);
  };

  const closeDialog = () => {
    setSelected(null);
    setMode(null);
    setPreview(null);
  };

  const confirm = async () => {
    if (!token || !selected || !mode) return;
    setBusy(true);
    try {
      if (mode === "disable") {
        await disableFeatureFlag(token, selected.moduleId, {
          reason,
          userMessageFr: userMessageFr || undefined
        });
      } else {
        await reactivateFeatureFlag(token, selected.moduleId, {
          reason: reason || undefined
        });
      }
      closeDialog();
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!ready || loading) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((mod) => (
          <Card key={mod.moduleId}>
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span>{mod.icon ?? "📦"}</span>
                {mod.moduleName}
              </CardTitle>
              <Badge variant={mod.isActive ? "outline" : "destructive"}>
                {mod.isActive ? t("active") : t("inactive")}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground font-mono">
                {mod.moduleId}
              </p>
              {!mod.isActive && mod.disableReason ? (
                <p className="text-sm text-muted-foreground">{mod.disableReason}</p>
              ) : null}
              <div className="flex gap-2">
                {mod.isActive && mod.canDisable ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void openDisable(mod)}
                  >
                    {t("disable")}
                  </Button>
                ) : null}
                {!mod.isActive && mod.canDisable ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openReactivate(mod)}
                  >
                    {t("reactivate")}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={mode != null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "disable"
                ? t("disableTitle", { name: selected?.moduleName ?? "" })
                : t("reactivateTitle", { name: selected?.moduleName ?? "" })}
            </DialogTitle>
          </DialogHeader>
          {mode === "disable" && preview ? (
            <div className="space-y-2 text-sm">
              <p>{t("impact")}</p>
              <ul className="list-disc pl-5 space-y-1">
                {preview.previews.flatMap((p) =>
                  p.tables.map((row) => (
                    <li key={`${p.moduleId}-${row.tableName}`}>
                      {row.tableName}: {row.count}
                    </li>
                  ))
                )}
              </ul>
              {preview.cascade.length > 0 ? (
                <p className="text-muted-foreground">
                  {t("cascade")}: {preview.cascade.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="module-reason">{t("reason")}</Label>
            <Textarea
              id="module-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          {mode === "disable" ? (
            <div className="space-y-2">
              <Label htmlFor="module-msg">{t("userMessage")}</Label>
              <Textarea
                id="module-msg"
                value={userMessageFr}
                onChange={(e) => setUserMessageFr(e.target.value)}
                rows={2}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeDialog}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={busy || (mode === "disable" && !reason.trim())}
              onClick={() => void confirm()}
            >
              {busy ? "…" : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
