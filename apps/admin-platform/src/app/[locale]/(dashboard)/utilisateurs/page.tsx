"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronLeft, ChevronRight, Search, Tractor } from "lucide-react";
import { apiFetch, type UsersListDto } from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { AccountStatusBadge } from "@/components/users/AccountStatusBadge";
import { UserActionsMenu } from "@/components/users/UserActionsMenu";
import { UserAvatar } from "@/components/users/UserAvatar";
import { FilterPills } from "@/components/layout/FilterPills";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PROFILE_FILTERS = [
  "all",
  "producer",
  "technician",
  "veterinarian",
  "buyer"
] as const;

const STATUS_FILTERS = ["all", "active", "suspended", "banned", "inactive"] as const;

type ProfileFilter = (typeof PROFILE_FILTERS)[number];
type StatusFilter = (typeof STATUS_FILTERS)[number];

const PAGE_SIZE = 10;

function formatSince(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { month: "short", year: "numeric" });
}

export default function UtilisateursPage() {
  const t = useTranslations("users");
  const locale = useLocale();
  const { token, ready } = useAdminToken();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [profile, setProfile] = useState<ProfileFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<UsersListDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debounced, profile, status]);

  const reload = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (debounced) params.set("search", debounced);
    if (profile !== "all") params.set("profileType", profile);
    if (status === "active" || status === "suspended" || status === "banned") {
      params.set("accountStatus", status);
    } else if (status === "inactive") {
      params.set("isActive", "false");
    }
    params.set("skip", String(page * PAGE_SIZE));
    params.set("take", String(PAGE_SIZE));
    apiFetch<UsersListDto>(`/admin/users?${params}`, token)
      .then(setData)
      .finally(() => setLoading(false));
  }, [token, debounced, profile, status, page]);

  useEffect(() => {
    reload();
  }, [reload]);

  const rows = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!ready) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-brand">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data ? t("total", { count: data.total }) : t("loading")}
        </p>
      </div>

      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:p-5 border-b border-border/60 bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <FilterPills
              items={STATUS_FILTERS}
              value={status}
              onChange={setStatus}
              label={(id) => t(`statusFilters.${id}`)}
            />
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={18}
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="pl-10 rounded-xl bg-muted/30 border-border/60"
              />
            </div>
          </div>
          <FilterPills
            items={PROFILE_FILTERS}
            value={profile}
            onChange={setProfile}
            label={(id) => t(`filters.${id}`)}
            size="sm"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="size-4 rounded border-border accent-brand cursor-pointer"
                    aria-label={t("selectAll")}
                  />
                </th>
                <th className="px-4 py-3 font-semibold">{t("columns.member")}</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">
                  {t("columns.profile")}
                </th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">
                  {t("columns.farm")}
                </th>
                <th className="px-4 py-3 font-semibold">{t("columns.status")}</th>
                <th className="px-4 py-3 font-semibold w-12" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="h-32 text-center text-muted-foreground">
                    …
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-32 text-center text-muted-foreground">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                rows.map((u) => {
                  const primaryProfile = u.profiles[0]?.type ?? "producer";
                  const isSelected = selected.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        "border-b border-border/40 transition-colors group",
                        isSelected ? "bg-brand/5" : "hover:bg-muted/40"
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(u.id)}
                          className="size-4 rounded border-border accent-brand cursor-pointer"
                          aria-label={u.fullName ?? u.email ?? u.id}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/utilisateurs/${u.id}`}
                          className="flex items-center gap-3 min-w-[200px]"
                        >
                          <UserAvatar
                            name={u.fullName}
                            email={u.email}
                            avatarUrl={u.avatarUrl}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate group-hover:text-brand transition">
                              {u.fullName ?? "—"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {u.email ?? "—"}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {u.profiles.map((p) => (
                            <Badge key={p.id} variant="secondary" className="rounded-lg text-xs">
                              {t(`profiles.${p.type}` as "profiles.producer")}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("since", { date: formatSince(u.createdAt, locale) })}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {u.primaryFarm ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="size-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                              <Tractor className="size-4 text-brand" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {u.primaryFarm.name}
                              </p>
                              <p className="text-xs truncate">{t("primaryFarm")}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AccountStatusBadge
                          status={u.accountStatus ?? (u.isActive ? "active" : "suspended")}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {token ? (
                          <UserActionsMenu user={u} token={token} onRefresh={reload} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-5 py-4 border-t border-border/60 bg-muted/10">
          <p className="text-sm text-muted-foreground">
            {t("pagination.page", { current: page + 1, total: pageCount })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 rounded-lg"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums">
              {page + 1}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 rounded-lg"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
