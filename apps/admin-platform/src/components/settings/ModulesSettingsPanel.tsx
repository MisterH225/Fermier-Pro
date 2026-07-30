"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addFeatureFlagTestAccount,
  disableFeatureFlag,
  fetchAdminFeatureFlags,
  fetchFeatureFlagTestAccounts,
  previewDisableFeatureFlag,
  reactivateFeatureFlag,
  removeFeatureFlagTestAccount,
  type AdminPlatformModuleDto,
  type FeatureFlagDisablePreviewDto,
  type FeatureFlagTestAccountDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { AdminSection } from "@/components/layout/AdminSection";
import { Puzzle } from "lucide-react";
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
import { Input } from "@/components/ui/input";

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
  const [mode, setMode] = useState<"disable" | "reactivate" | "testAccounts" | null>(null);
  const [testAccounts, setTestAccounts] = useState<FeatureFlagTestAccountDto[]>([]);
  const [testUserId, setTestUserId] = useState("");
  const [testError, setTestError] = useState<string | null>(null);

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

  const openTestAccounts = async (mod: AdminPlatformModuleDto) => {
    if (!token) return;
    setSelected(mod);
    setMode("testAccounts");
    setTestUserId("");
    setTestError(null);
    setPreview(null);
    const rows = await fetchFeatureFlagTestAccounts(token, mod.moduleId);
    setTestAccounts(rows);
  };

  const closeDialog = () => {
    setSelected(null);
    setMode(null);
    setPreview(null);
    setTestAccounts([]);
    setTestError(null);
  };

  const confirm = async () => {
    if (!token || !selected || !mode) return;
    if (mode === "testAccounts") return;
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

  const addTestAccount = async () => {
    if (!token || !selected || !testUserId.trim()) return;
    setBusy(true);
    setTestError(null);
    try {
      await addFeatureFlagTestAccount(token, selected.moduleId, testUserId.trim());
      setTestUserId("");
      const rows = await fetchFeatureFlagTestAccounts(token, selected.moduleId);
      setTestAccounts(rows);
      await load();
    } catch {
      setTestError(t("testAccountAddError"));
    } finally {
      setBusy(false);
    }
  };

  const removeTestAccount = async (userId: string) => {
    if (!token || !selected) return;
    setBusy(true);
    try {
      await removeFeatureFlagTestAccount(token, selected.moduleId, userId);
      const rows = await fetchFeatureFlagTestAccounts(token, selected.moduleId);
      setTestAccounts(rows);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!ready || loading) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <AdminPageShell>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <AdminSection icon={Puzzle} title={t("gridTitle")} description={t("subtitle")} bare>
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
              {mod.description ? (
                <p className="text-sm text-muted-foreground">{mod.description}</p>
              ) : null}
              {!mod.isActive && mod.disableReason ? (
                <p className="text-sm text-muted-foreground">{mod.disableReason}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {t("testAccountsCount", { count: mod.testAccountCount ?? 0 })}
              </p>
              <div className="flex flex-wrap gap-2">
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void openTestAccounts(mod)}
                >
                  {t("manageTestAccounts")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </AdminSection>

      <Dialog open={mode != null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "disable"
                ? t("disableTitle", { name: selected?.moduleName ?? "" })
                : mode === "reactivate"
                  ? t("reactivateTitle", { name: selected?.moduleName ?? "" })
                  : `${t("testAccounts")} — ${selected?.moduleName ?? ""}`}
            </DialogTitle>
          </DialogHeader>
          {mode === "testAccounts" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("testAccountsHint")}</p>
              <div className="flex gap-2">
                <Input
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  placeholder={t("testAccountUserId")}
                />
                <Button
                  type="button"
                  disabled={busy || !testUserId.trim()}
                  onClick={() => void addTestAccount()}
                >
                  {t("addTestAccount")}
                </Button>
              </div>
              {testError ? (
                <p className="text-sm text-destructive">{testError}</p>
              ) : null}
              {testAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("testAccountsEmpty")}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {testAccounts.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-2 font-mono"
                    >
                      <span className="truncate">{row.userId}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void removeTestAccount(row.userId)}
                      >
                        {t("removeTestAccount")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={closeDialog}>
                  {t("cancel")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}
