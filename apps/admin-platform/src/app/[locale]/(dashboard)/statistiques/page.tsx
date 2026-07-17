"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  fetchRegionalStatSections,
  fetchRegionalStatsMeta,
  type RegionalStatsMetaDto
} from "@/lib/api";
import type { InstitutionStatSection } from "@/lib/institution-stat-sections";
import { useAdminAccess } from "@/lib/admin-access-context";
import { useAdminToken } from "@/lib/useAdminToken";
import { useInstitutionPreview } from "@/lib/institution-preview-context";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPageShell } from "@/components/layout/AdminPageShell";
import { FilterPills } from "@/components/layout/FilterPills";
import { InstitutionPreviewBanner } from "@/components/institution/InstitutionPreviewBanner";
import { InstitutionPreviewSelector } from "@/components/institution/InstitutionPreviewSelector";
import { InternalStatsView } from "@/components/statistics/InternalStatsView";
import { RegionalStatsExportButton } from "@/components/statistics/RegionalStatsExportButton";
import { RegionalStatsSectionPanel } from "@/components/statistics/RegionalStatsSectionPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const PAGE_TABS = ["regional", "internal"] as const;
type PageTab = (typeof PAGE_TABS)[number];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** 30 derniers jours des snapshots disponibles (pas depuis 1970 / 2024). */
function rangeFromMeta(meta: RegionalStatsMetaDto | null): {
  from: string;
  to: string;
} {
  const today = isoDate(new Date());
  if (!meta?.latestSnapshotDate) {
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - 29);
    return { from: isoDate(from), to: today };
  }
  const to = meta.latestSnapshotDate;
  const toDate = new Date(`${to}T00:00:00.000Z`);
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - 29);
  let from = isoDate(fromDate);
  if (
    meta.earliestSnapshotDate &&
    from < meta.earliestSnapshotDate
  ) {
    from = meta.earliestSnapshotDate;
  }
  return { from, to };
}

export default function StatistiquesPage() {
  const t = useTranslations("stats");
  const tRegional = useTranslations("stats.regional");
  const { profile, ready: accessReady } = useAdminAccess();
  const { token, ready: tokenReady } = useAdminToken();
  const { viewAsInstitutionId } = useInstitutionPreview();
  const [pageTab, setPageTab] = useState<PageTab>("regional");
  const [sections, setSections] = useState<InstitutionStatSection[]>([]);
  const [isSuperadminSections, setIsSuperadminSections] = useState(false);
  const [activeSection, setActiveSection] = useState<InstitutionStatSection | null>(
    null
  );
  const [loadingSections, setLoadingSections] = useState(true);
  const [meta, setMeta] = useState<RegionalStatsMetaDto | null>(null);
  const [rangeReady, setRangeReady] = useState(false);
  const [{ from, to }, setRange] = useState({ from: "", to: "" });

  const isSuperadmin = profile?.role === "superadmin";
  const showInternalTab = isSuperadmin && !viewAsInstitutionId;

  const servedSections = useMemo(
    () => sections.filter((section) => section !== "movements"),
    [sections]
  );

  useEffect(() => {
    if (!token) return;
    setLoadingSections(true);
    setRangeReady(false);
    void Promise.all([
      fetchRegionalStatSections(token, viewAsInstitutionId),
      fetchRegionalStatsMeta(token, viewAsInstitutionId)
    ])
      .then(([sectionsRes, metaRes]) => {
        const next = sectionsRes.sections.filter(
          (section): section is InstitutionStatSection =>
            section !== "movements"
        );
        setSections(sectionsRes.sections as InstitutionStatSection[]);
        setIsSuperadminSections(sectionsRes.isSuperadmin === true);
        setActiveSection((prev) =>
          prev && next.includes(prev) ? prev : (next[0] ?? null)
        );
        setMeta(metaRes);
        setRange(rangeFromMeta(metaRes));
      })
      .catch(() => {
        setSections([]);
        setActiveSection(null);
        setMeta(null);
        setRange(rangeFromMeta(null));
      })
      .finally(() => {
        setLoadingSections(false);
        setRangeReady(true);
      });
  }, [token, viewAsInstitutionId]);

  useEffect(() => {
    if (!showInternalTab && pageTab === "internal") {
      setPageTab("regional");
    }
  }, [showInternalTab, pageTab]);

  if (!tokenReady || !accessReady || !token) {
    return <p className="text-muted-foreground">…</p>;
  }

  return (
    <AdminPageShell wide>
      <InstitutionPreviewBanner />
      <PageHeader
        title={t("title")}
        description={t("pageLead")}
        action={
          <div className="flex flex-wrap items-end gap-3">
            {isSuperadmin ? <InstitutionPreviewSelector /> : null}
            {showInternalTab ? (
              <FilterPills
                items={PAGE_TABS}
                value={pageTab}
                onChange={setPageTab}
                label={(tab) => t(`tabs.${tab}`)}
              />
            ) : null}
          </div>
        }
      />

      {pageTab === "internal" && showInternalTab ? (
        <InternalStatsView token={token} />
      ) : (
        <div className="space-y-6">
          {loadingSections || !rangeReady ? (
            <p className="text-muted-foreground">…</p>
          ) : servedSections.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {tRegional("emptySections")}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="stats-from">{tRegional("from")}</Label>
                    <Input
                      id="stats-from"
                      type="date"
                      value={from}
                      min={meta?.earliestSnapshotDate ?? undefined}
                      max={to || undefined}
                      onChange={(e) =>
                        setRange((prev) => ({ ...prev, from: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="stats-to">{tRegional("to")}</Label>
                    <Input
                      id="stats-to"
                      type="date"
                      value={to}
                      min={from || meta?.earliestSnapshotDate || undefined}
                      max={meta?.latestSnapshotDate ?? undefined}
                      onChange={(e) =>
                        setRange((prev) => ({ ...prev, to: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <RegionalStatsExportButton
                  token={token}
                  sections={servedSections}
                  from={from}
                  to={to}
                  viewAsInstitutionId={viewAsInstitutionId}
                />
              </div>

              {meta?.earliestSnapshotDate && meta.latestSnapshotDate ? (
                <p className="text-xs text-muted-foreground">
                  {tRegional("dataAvailability", {
                    from: meta.earliestSnapshotDate,
                    to: meta.latestSnapshotDate
                  })}
                </p>
              ) : (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {tRegional("noSnapshotsYet")}
                </p>
              )}

              <FilterPills
                items={servedSections}
                value={activeSection ?? servedSections[0]}
                onChange={setActiveSection}
                label={(section) => tRegional(`sections.${section}`)}
              />

              {isSuperadminSections && !viewAsInstitutionId ? (
                <p className="text-xs text-muted-foreground">
                  {tRegional("superadminHint")}
                </p>
              ) : null}

              {activeSection && from && to ? (
                <RegionalStatsSectionPanel
                  token={token}
                  section={activeSection}
                  from={from}
                  to={to}
                />
              ) : null}
            </>
          )}
        </div>
      )}
    </AdminPageShell>
  );
}
