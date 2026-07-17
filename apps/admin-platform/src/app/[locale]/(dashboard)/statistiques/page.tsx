"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { fetchRegionalStatSections } from "@/lib/api";
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
import { RegionalStatsSectionPanel } from "@/components/statistics/RegionalStatsSectionPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const PAGE_TABS = ["regional", "internal"] as const;
type PageTab = (typeof PAGE_TABS)[number];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: isoDate(from), to: isoDate(to) };
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
  const [{ from, to }, setRange] = useState(defaultDateRange);

  const isSuperadmin = profile?.role === "superadmin";
  const showInternalTab = isSuperadmin && !viewAsInstitutionId;

  const servedSections = useMemo(
    () => sections.filter((section) => section !== "movements"),
    [sections]
  );

  useEffect(() => {
    if (!token) return;
    setLoadingSections(true);
    void fetchRegionalStatSections(token, viewAsInstitutionId)
      .then((res) => {
        const next = res.sections.filter(
          (section): section is InstitutionStatSection =>
            section !== "movements"
        );
        setSections(res.sections as InstitutionStatSection[]);
        setIsSuperadminSections(res.isSuperadmin === true);
        setActiveSection((prev) =>
          prev && next.includes(prev) ? prev : (next[0] ?? null)
        );
      })
      .catch(() => {
        setSections([]);
        setActiveSection(null);
      })
      .finally(() => setLoadingSections(false));
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
          {loadingSections ? (
            <p className="text-muted-foreground">…</p>
          ) : servedSections.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {tRegional("emptySections")}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="stats-from">{tRegional("from")}</Label>
                  <Input
                    id="stats-from"
                    type="date"
                    value={from}
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
                    onChange={(e) =>
                      setRange((prev) => ({ ...prev, to: e.target.value }))
                    }
                  />
                </div>
              </div>

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

              {activeSection ? (
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
