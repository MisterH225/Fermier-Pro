"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createSuperAdmin,
  fetchSuperAdmins,
  removeSuperAdmin,
  type SuperAdminRowDto
} from "@/lib/api";
import { fetchAdminMe } from "@/lib/admin-auth";
import { useAdminToken } from "@/lib/useAdminToken";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "./SettingsSection";
import { ShieldCheck } from "lucide-react";

type Props = {
  currentUserId?: string | null;
};

export function AdminsManagementCard({ currentUserId: currentUserIdProp }: Props) {
  const t = useTranslations("settings.admins");
  const { token, ready } = useAdminToken();
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    currentUserIdProp ?? null
  );
  const [admins, setAdmins] = useState<SuperAdminRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSuperAdmins(token);
      setAdmins(rows);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void reload();
    if (currentUserIdProp == null) {
      void fetchAdminMe(token)
        .then((me) => setCurrentUserId(me.userId))
        .catch(() => undefined);
    }
  }, [ready, token, reload, currentUserIdProp]);

  const onAdd = async () => {
    if (!token) return;
    setError(null);
    setSuccess(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t("emailRequired"));
      return;
    }
    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    setBusy(true);
    try {
      await createSuperAdmin(token, {
        email: trimmedEmail,
        password,
        fullName: fullName.trim() || undefined
      });
      setEmail("");
      setFullName("");
      setPassword("");
      setSuccess(t("added"));
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("addError");
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (row: SuperAdminRowDto) => {
    if (!token) return;
    if (!window.confirm(t("removeConfirm", { email: row.email ?? row.userId }))) {
      return;
    }
    setError(null);
    setSuccess(null);
    setRemovingId(row.userId);
    try {
      await removeSuperAdmin(token, row.userId);
      setSuccess(t("removed"));
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("removeError");
      setError(msg);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <SettingsSection
      id="admins"
      icon={ShieldCheck}
      title={t("title")}
      description={t("description")}
      bare
    >
      <div className="space-y-6">
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <p className="text-sm font-medium text-foreground">{t("listTitle")}</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="divide-y rounded-2xl border">
              {admins.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{row.email ?? "—"}</p>
                    {row.fullName ? (
                      <p className="text-muted-foreground">{row.fullName}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {t("addedAt", {
                        date: new Date(row.createdAt).toLocaleDateString()
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.userId === currentUserId ? (
                      <Badge variant="secondary">{t("you")}</Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={removingId === row.userId}
                        onClick={() => void onRemove(row)}
                      >
                        {removingId === row.userId ? "…" : t("remove")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <p className="text-sm font-medium text-foreground">{t("addTitle")}</p>
          <div className="space-y-2">
            <Label htmlFor="admin-email">{t("email")}</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-fullname">{t("fullName")}</Label>
            <Input
              id="admin-fullname"
              type="text"
              autoComplete="off"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("fullNamePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">{t("defaultPassword")}</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
          </div>
          {error ? (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl px-3 py-2">
              {error}
            </p>
          ) : null}
          {success ? (
            <Badge variant="success">{success}</Badge>
          ) : null}
          <Button type="button" size="sm" disabled={busy} onClick={() => void onAdd()}>
            {busy ? "…" : t("add")}
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}
