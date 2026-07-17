"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  createInstitutionConsoleUser,
  fetchInstitutionConsoleUsers,
  removeInstitutionConsoleUser,
  resendInstitutionConsoleInvite,
  updateInstitutionConsoleUser,
  type InstitutionConsoleUserDto,
  type InstitutionScheduledReportsConfig
} from "@/lib/api";
import {
  EDITABLE_STAT_SECTIONS,
  type EditableStatSection,
  type StatSectionPermissions
} from "@/lib/institution-stat-sections";
import { useAdminToken } from "@/lib/useAdminToken";
import { NAV_KEYS, type NavKey } from "@/components/layout/nav-config";
import type { AdminMenuAccess } from "@/lib/admin-permissions";
import { getAdminPasswordRecoveryRedirectTo } from "@/lib/admin-oauth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClass } from "@/lib/ui-styles";
import { AdminSection } from "@/components/layout/AdminSection";
import { Building2 } from "lucide-react";

type PermissionDraft = Partial<Record<NavKey, AdminMenuAccess | "">>;
type StatSectionDraft = StatSectionPermissions;

function emptyPermissions(): PermissionDraft {
  return {};
}

function emptyStatSections(): StatSectionDraft {
  return {};
}

function statSectionsFromRow(
  row: InstitutionConsoleUserDto
): StatSectionDraft {
  const out: StatSectionDraft = {};
  for (const key of EDITABLE_STAT_SECTIONS) {
    if (row.statSectionPermissions?.[key] === true) {
      out[key] = true;
    }
  }
  return out;
}

function emptyScheduledReports(): InstitutionScheduledReportsConfig {
  return { isActive: false, cadence: "monthly", format: "pdf", sections: [] };
}

function scheduledReportsFromRow(
  row: InstitutionConsoleUserDto
): InstitutionScheduledReportsConfig {
  return row.scheduledReports ?? emptyScheduledReports();
}

function permissionsFromRow(row: InstitutionConsoleUserDto): PermissionDraft {
  const out: PermissionDraft = {};
  for (const [key, access] of Object.entries(row.menuPermissions)) {
    if (access === "read" || access === "write") {
      out[key as NavKey] = access;
    }
  }
  return out;
}

export function InstitutionUsersManagementCard() {
  const t = useTranslations("settings.institutions");
  const tStats = useTranslations("stats.regional.sections");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const { token, ready } = useAdminToken();
  const [rows, setRows] = useState<InstitutionConsoleUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [institutionLabel, setInstitutionLabel] = useState("");
  const [permissions, setPermissions] = useState<PermissionDraft>(emptyPermissions());
  const [statSections, setStatSections] =
    useState<StatSectionDraft>(emptyStatSections());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] =
    useState<PermissionDraft>(emptyPermissions());
  const [editStatSections, setEditStatSections] =
    useState<StatSectionDraft>(emptyStatSections());
  const [editScheduledReports, setEditScheduledReports] =
    useState<InstitutionScheduledReportsConfig>(emptyScheduledReports());
  const [editLabel, setEditLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
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

  const buildStatSectionPermissions = (
    draft: StatSectionDraft
  ): Record<string, boolean> => {
    const out: Record<string, boolean> = {};
    for (const key of EDITABLE_STAT_SECTIONS) {
      if (draft[key] === true) {
        out[key] = true;
      }
    }
    return out;
  };

  const onPermissionChange = (
    draftSetter: React.Dispatch<React.SetStateAction<PermissionDraft>>,
    key: NavKey,
    value: string
  ) => {
    draftSetter((prev) => ({
      ...prev,
      [key]: value === "" ? "" : (value as AdminMenuAccess)
    }));
  };

  const onStatSectionToggle = (
    draftSetter: React.Dispatch<React.SetStateAction<StatSectionDraft>>,
    key: EditableStatSection,
    checked: boolean
  ) => {
    draftSetter((prev) => ({
      ...prev,
      [key]: checked
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
        menuPermissions,
        statSectionPermissions: buildStatSectionPermissions(statSections)
      });
      setEmail("");
      setFullName("");
      setInstitutionLabel("");
      setPermissions(emptyPermissions());
      setStatSections(emptyStatSections());
      setSuccess(t("invited"));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("inviteError"));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (row: InstitutionConsoleUserDto) => {
    setEditingId(row.id);
    setEditPermissions(permissionsFromRow(row));
    setEditStatSections(statSectionsFromRow(row));
    setEditScheduledReports(scheduledReportsFromRow(row));
    setEditLabel(row.institutionLabel ?? "");
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPermissions(emptyPermissions());
    setEditStatSections(emptyStatSections());
    setEditScheduledReports(emptyScheduledReports());
    setEditLabel("");
  };

  const onSaveEdit = async (row: InstitutionConsoleUserDto) => {
    if (!token) return;
    const menuPermissions = buildMenuPermissions(editPermissions);
    if (Object.keys(menuPermissions).length === 0) {
      setError(t("permissionsRequired"));
      return;
    }
    setSavingEditId(row.id);
    setError(null);
    setSuccess(null);
    try {
      await updateInstitutionConsoleUser(token, row.id, {
        institutionLabel: editLabel.trim() || undefined,
        menuPermissions,
        statSectionPermissions: buildStatSectionPermissions(editStatSections),
        scheduledReports: editScheduledReports
      });
      setSuccess(t("updated"));
      cancelEdit();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("updateError"));
    } finally {
      setSavingEditId(null);
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
      if (editingId === row.id) {
        cancelEdit();
      }
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

  const StatSectionMatrix = ({
    draft,
    onToggle,
    idPrefix
  }: {
    draft: StatSectionDraft;
    onToggle: (key: EditableStatSection, checked: boolean) => void;
    idPrefix: string;
  }) => (
    <div className="grid gap-2 sm:grid-cols-2">
      {EDITABLE_STAT_SECTIONS.map((key) => (
        <label
          key={`${idPrefix}-${key}`}
          htmlFor={`${idPrefix}-${key}`}
          className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <input
            id={`${idPrefix}-${key}`}
            type="checkbox"
            checked={draft[key] === true}
            onChange={(e) => onToggle(key, e.target.checked)}
          />
          <span>{tStats(key)}</span>
        </label>
      ))}
    </div>
  );

  return (
    <AdminSection
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
                        onClick={() =>
                          editingId === row.id ? cancelEdit() : startEdit(row)
                        }
                      >
                        {editingId === row.id ? t("cancelEdit") : t("edit")}
                      </Button>
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
                  <div className="rounded-xl bg-muted/40 p-3 space-y-3">
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {t("permissionsTitle")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(row.menuPermissions).map(([key, access]) => (
                          <Badge key={key} variant="secondary">
                            {tNav(key as NavKey)} ·{" "}
                            {access === "write" ? t("accessWrite") : t("accessRead")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {t("statSectionsTitle")}
                      </p>
                      {Object.entries(row.statSectionPermissions ?? {}).filter(
                        ([, enabled]) => enabled
                      ).length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t("statSectionsEmpty")}
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(row.statSectionPermissions ?? {})
                            .filter(([, enabled]) => enabled)
                            .map(([key]) => (
                              <Badge key={key} variant="outline">
                                {tStats(key as EditableStatSection)}
                              </Badge>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {editingId === row.id ? (
                    <div className="rounded-xl border bg-background p-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`edit-label-${row.id}`}>
                          {t("institutionLabel")}
                        </Label>
                        <Input
                          id={`edit-label-${row.id}`}
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{t("permissionsTitle")}</p>
                        <PermissionMatrix
                          draft={editPermissions}
                          onChange={(key, value) =>
                            onPermissionChange(setEditPermissions, key, value)
                          }
                          idPrefix={`edit-menu-${row.id}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{t("statSectionsTitle")}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("statSectionsLead")}
                        </p>
                        <StatSectionMatrix
                          draft={editStatSections}
                          onToggle={(key, checked) =>
                            onStatSectionToggle(setEditStatSections, key, checked)
                          }
                          idPrefix={`edit-stats-${row.id}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{t("scheduledReportsTitle")}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("scheduledReportsLead")}
                        </p>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editScheduledReports.isActive}
                            onChange={(e) =>
                              setEditScheduledReports((prev) => ({
                                ...prev,
                                isActive: e.target.checked
                              }))
                            }
                          />
                          {t("scheduledReportsActive")}
                        </label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor={`edit-cadence-${row.id}`}>
                              {t("scheduledReportsCadence")}
                            </Label>
                            <select
                              id={`edit-cadence-${row.id}`}
                              className={selectClass}
                              value={editScheduledReports.cadence}
                              onChange={(e) =>
                                setEditScheduledReports((prev) => ({
                                  ...prev,
                                  cadence: e.target.value as "monthly" | "weekly"
                                }))
                              }
                            >
                              <option value="monthly">{t("scheduledReportsMonthly")}</option>
                              <option value="weekly">{t("scheduledReportsWeekly")}</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`edit-format-${row.id}`}>
                              {t("scheduledReportsFormat")}
                            </Label>
                            <select
                              id={`edit-format-${row.id}`}
                              className={selectClass}
                              value={editScheduledReports.format}
                              onChange={(e) =>
                                setEditScheduledReports((prev) => ({
                                  ...prev,
                                  format: e.target.value as "pdf" | "csv"
                                }))
                              }
                            >
                              <option value="pdf">PDF</option>
                              <option value="csv">CSV (zip)</option>
                            </select>
                          </div>
                        </div>
                        <StatSectionMatrix
                          draft={Object.fromEntries(
                            editScheduledReports.sections.map((key) => [key, true])
                          ) as StatSectionDraft}
                          onToggle={(key, checked) =>
                            setEditScheduledReports((prev) => ({
                              ...prev,
                              sections: checked
                                ? [...new Set([...prev.sections, key])]
                                : prev.sections.filter((s) => s !== key)
                            }))
                          }
                          idPrefix={`edit-scheduled-${row.id}`}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingEditId === row.id}
                        onClick={() => void onSaveEdit(row)}
                      >
                        {savingEditId === row.id ? "…" : t("saveEdit")}
                      </Button>
                    </div>
                  ) : null}
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
              onChange={(key, value) =>
                onPermissionChange(setPermissions, key, value)
              }
              idPrefix="invite"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("statSectionsTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("statSectionsLead")}</p>
            <StatSectionMatrix
              draft={statSections}
              onToggle={(key, checked) =>
                onStatSectionToggle(setStatSections, key, checked)
              }
              idPrefix="invite-stats"
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
    </AdminSection>
  );
}
