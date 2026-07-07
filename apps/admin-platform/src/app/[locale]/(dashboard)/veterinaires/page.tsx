"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { fetchVetProfiles, type VetProfileRow } from "@/lib/api";
import { useAdminToken } from "@/lib/useAdminToken";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { AdminSection } from "@/components/layout/AdminSection";
import { FilterPills } from "@/components/layout/FilterPills";
import { Stethoscope } from "lucide-react";
import { VetStatusBadge } from "@/components/vets/VetStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const TABS = ["pending", "verified", "rejected", "all"] as const;

type Tab = (typeof TABS)[number];

export default function VetsPage() {
  const t = useTranslations("vets");
  const { token, ready } = useAdminToken();
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<VetProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const status = tab === "all" ? undefined : tab;
    setLoading(true);
    fetchVetProfiles(token, status ? { status } : undefined)
      .then((list) => setRows(list ?? []))
      .finally(() => setLoading(false));
  }, [token, tab]);

  const filtered = useMemo(() => rows, [rows]);

  const statusLabel = (status: string) => {
    if (status === "pending" || status === "verified" || status === "rejected") {
      return t(`statusLabels.${status}`);
    }
    return status;
  };

  if (!ready) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <AdminPageShell wide>
      <PageHeader title={t("title")} description={t("pageLead")} />

      <AdminSection icon={Stethoscope} title={t("directoryTitle")} description={t("directoryDesc")} bare>
        <div className="space-y-4">
      <FilterPills
        items={TABS}
        value={tab}
        onChange={setTab}
        label={(id) => t(`tabs.${id}`)}
      />

      {loading ? (
        <p className="text-muted-foreground">…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((v) => (
            <Card key={v.id}>
              <CardContent className="flex flex-wrap gap-4 items-center p-5">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-lg">{v.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {v.schoolName} · {v.graduationYear} · {v.locationCountry}
                  </p>
                  <div className="mt-2">
                    <VetStatusBadge
                      status={v.verificationStatus}
                      label={statusLabel(v.verificationStatus)}
                    />
                  </div>
                </div>
                <Button variant="outline" asChild>
                  <Link href={`/veterinaires/${v.id}`}>{t("view")}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
        </div>
      </AdminSection>
    </AdminPageShell>
  );
}
