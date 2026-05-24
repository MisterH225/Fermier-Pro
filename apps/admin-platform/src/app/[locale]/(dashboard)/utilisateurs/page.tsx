"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Search } from "lucide-react";
import { apiFetch, type UsersListDto } from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterPills } from "@/components/layout/FilterPills";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

const PROFILE_FILTERS = [
  "all",
  "producer",
  "technician",
  "veterinarian",
  "buyer"
] as const;

type ProfileFilter = (typeof PROFILE_FILTERS)[number];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

export default function UtilisateursPage() {
  const t = useTranslations("users");
  const { token, ready } = useAdminToken();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [profile, setProfile] = useState<ProfileFilter>("all");
  const [data, setData] = useState<UsersListDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (debounced) params.set("search", debounced);
    if (profile !== "all") params.set("profileType", profile);
    params.set("take", "50");
    const q = params.toString() ? `?${params}` : "";
    apiFetch<UsersListDto>(`/admin/users${q}`, token)
      .then(setData)
      .finally(() => setLoading(false));
  }, [token, debounced, profile]);

  const rows = useMemo(() => data?.items ?? [], [data]);

  if (!ready) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={data ? t("total", { count: data.total }) : undefined}
      />

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-10"
          />
        </div>
        <FilterPills
          items={PROFILE_FILTERS}
          value={profile}
          onChange={setProfile}
          label={(id) => t(`filters.${id}`)}
        />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.name")}</TableHead>
              <TableHead>{t("columns.email")}</TableHead>
              <TableHead>{t("columns.profile")}</TableHead>
              <TableHead>{t("columns.farm")}</TableHead>
              <TableHead>{t("columns.joined")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead className="text-right">{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  …
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {(u.fullName ?? u.email ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                      <span className="font-medium">{u.fullName ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.profiles.map((p) => (
                        <Badge key={p.id} variant="secondary">
                          {t(`profiles.${p.type}` as "profiles.producer")}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.primaryFarm?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        u.isActive
                          ? "bg-green-100 text-green-900 border-green-200"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {u.isActive ? t("status.active") : t("status.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link href={`/utilisateurs/${u.id}`}>{t("view")}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
