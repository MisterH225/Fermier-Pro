"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  createInstitutionConsoleUser,
  fetchInstitutionConsoleUsers,
  removeInstitutionConsoleUser,
  resendInstitutionConsoleInvite,
  updateInstitutionConsoleUser,
  type InstitutionConsoleUserDto
} from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { NAV_KEYS, type NavKey } from "@/components/layout/nav-config";
import type { AdminMenuAccess } from "@/lib/admin-permissions";
import { getAdminPasswordRecoveryRedirectTo } from "@/lib/admin-oauth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClass } from "@/lib/ui-styles";
import { SettingsSection } from "./SettingsSection";
import { Building2 } from "lucide-react";

type PermissionDraft = Partial<Record<NavKey, AdminMenuAccess | "">>;

function emptyPermissions(): PermissionDraft {
  return {};
}

export function InstitutionUsersManagementCard() {
  const t = useTranslations("settings.institutions");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const { token, ready } = useAdminToken();
  const [rows, setRows] = useState<InstitutionConsoleUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [institutionLabel, setInstitutionLabel] = useState("");
  const [permissions, setPermissions] = useState<PermissionDraft>(emptyPermissions());
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const menuKeys = useMemo(() => [...NAV_KEYS], []);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchInstitutionConsoleUsers(token);
      setRows(list);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void reload();
  }, [ready, token, reload]);

  const buildMenuPermissions = (
    draft: PermissionDraft
  ): Record<string, "read" | "write"> => {
    const out: Record<string, "read" | "write"> = {};
    for (const key of menuKeys) {
      const access = draft[key];
      if (access === "read" || access === "write") {
        out[key] = access;
      }
    }
    return out;
  };

  const onPermissionChange = (key: NavKey, value: string) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: value === "" ? "" : (value as AdminMenuAccess)
    }));
  };

  const onInvite = async () => {
    if (!token) return;
    setError(null);
    setSuccess(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t("emailRequired"));
      return;
    }
    const menuPermissions = buildMenuPermissions(permissions);
    if (Object.keys(menuPermissions).length === 0) {
      setError(t("permissionsRequired"));
      return;
    }
    setBusy(true);
    try {
      await createInstitutionConsoleUser(token, {
        email: trimmedEmail,
        fullName: fullName.trim() || undefined,
        institutionLabel: institutionLabel.trim() || undefined,
        inviteRedirectTo: getAdminPasswordRecoveryRedirectTo(locale),
        menuPermissions
      });
      setEmail("");
      setFullName("");
      setInstitutionLabel("");
      setPermissions(emptyPermissions());
      setSuccess(t("invited"));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("inviteError"));
    } finally {
      setBusy(false);
    }
  };

  const onToggleActive = async (row: InstitutionConsoleUserDto) => {
    if (!token) return;
    setError(null);
    setSuccess(null);
    try {
      await updateInstitutionConsoleUser(token, row.id, {
        isActive: !row.isActive
      });
      setSuccess(t("updated"));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("updateError"));
    }
  };

  const onRemove = async (row: InstitutionConsoleUserDto) => {
    if (!token) return;
    if (!window.confirm(t("removeConfirm", { email: row.email ?? row.userId }))) {
      return;
    }
    setRemovingId(row.id);
    setError(null);
    setSuccess(null);
    try {
      await removeInstitutionConsoleUser(token, row.id);
      setSuccess(t("removed"));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("removeError"));
    } finally {
      setRemovingId(null);
    }
  };

  const onResendInvite = async (row: InstitutionConsoleUserDto) => {
    if (!token) return;
    setResendingId(row.id);
    setError(null);
    setSuccess(null);
    try {
      await resendInstitutionConsoleInvite(
        token,
        row.id,
        getAdminPasswordRecoveryRedirectTo(locale)
      );
      setSuccess(t("inviteResent"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("inviteError"));
    } finally {
      setResendingId(null);
    }
  };

  const PermissionMatrix = ({
    draft,
    onChange,
    idPrefix
  }: {
    draft: PermissionDraft;
    onChange: (key: NavKey, value: string) => void;
    idPrefix: string;
  }) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {menuKeys.map((key) => (
        <div key={`${idPrefix}-${key}`} className="space-y-1">
          <Label htmlFor={`${idPrefix}-${key}`} className="text-xs font-semibold">
            {tNav(key)}
          </Label>
          <select
            id={`${idPrefix}-${key}`}
            value={draft[key] ?? ""}
            onChange={(e) => onChange(key, e.target.value)}
            className={selectClass}
          >
            <option value="">{t("accessNone")}</option>
            <option value="read">{t("accessRead")}</option>
            <option value="write">{t("accessWrite")}</option>
          </select>
        </div>
      ))}
    </div>
  );

  return (
    <SettingsSection
      id="institutions"
      icon={Building2}
      title={t("title")}
      description={t("description")}
      bare
    >
      <div className="space-y-6">
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <p className="text-sm font-medium text-foreground">{t("listTitle")}</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="divide-y rounded-2xl border">
              {rows.map((row) => (
                <li key={row.id} className="space-y-3 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{row.email ?? "—"}</p>
                      {row.institutionLabel ? (
                        <p className="text-sm text-brand-olive">{row.institutionLabel}</p>
                      ) : null}
                      {row.fullName ? (
                        <p className="text-sm text-muted-foreground">{row.fullName}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {row.acceptedAt
                          ? t("acceptedAt", {
                              date: new Date(row.acceptedAt).toLocaleDateString()
                            })
                          : t("pendingInvite")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={row.isActive ? "success" : "secondary"}>
                        {row.isActive ? t("active") : t("inactive")}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void onToggleActive(row)}
                      >
                        {row.isActive ? t("deactivate") : t("activate")}
                      </Button>
                      {!row.acceptedAt ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={resendingId === row.id}
                          onClick={() => void onResendInvite(row)}
                        >
                          {resendingId === row.id ? "…" : t("resendInvite")}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={removingId === row.id}
                        onClick={() => void onRemove(row)}
                      >
                        {removingId === row.id ? "…" : t("remove")}
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {t("permissionsTitle")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(row.menuPermissions).map(([key, access]) => (
                        <Badge key={key} variant="secondary">
                          {tNav(key as NavKey)} · {access === "write" ? t("accessWrite") : t("accessRead")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
          <p className="text-sm font-medium text-foreground">{t("inviteTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("inviteLead")}</p>
          <div className="space-y-2">
            <Label htmlFor="institution-email">{t("email")}</Label>
            <Input
              id="institution-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@institution.gouv"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="institution-fullname">{t("fullName")}</Label>
            <Input
              id="institution-fullname"
              type="text"
              autoComplete="off"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="institution-label">{t("institutionLabel")}</Label>
            <Input
              id="institution-label"
              type="text"
              autoComplete="off"
              value={institutionLabel}
              onChange={(e) => setInstitutionLabel(e.target.value)}
              placeholder={t("institutionLabelPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("permissionsTitle")}</p>
            <PermissionMatrix
              draft={permissions}
              onChange={onPermissionChange}
              idPrefix="invite"
            />
          </div>
          {error ? (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {success ? <Badge variant="success">{success}</Badge> : null}
          <Button type="button" size="sm" disabled={busy} onClick={() => void onInvite()}>
            {busy ? "…" : t("invite")}
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}
