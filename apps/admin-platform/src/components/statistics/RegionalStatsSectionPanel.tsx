"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { InstitutionStatSection } from "@/lib/institution-stat-sections";
import {
  fetchRegionalEconomy,
  fetchRegionalGrowth,
  fetchRegionalHerd,
  fetchRegionalMortality,
  fetchRegionalReproduction,
  fetchRegionalVetCoverage,
  type RegionalStatsResponse
} from "@/lib/api";
import { useInstitutionPreview } from "@/lib/institution-preview-context";
import { AdminSection } from "@/components/layout/AdminSection";
import { RegionalStatsCoverageBanner } from "@/components/statistics/RegionalStatsCoverageBanner";
import { RegionalStatsDepartmentTable } from "@/components/statistics/RegionalStatsDepartmentTable";
import { Activity } from "lucide-react";

type Props = {
  token: string;
  section: InstitutionStatSection;
  from: string;
  to: string;
};

async function fetchSection(
  token: string,
  section: InstitutionStatSection,
  from: string,
  to: string,
  viewAsInstitutionId?: string | null
): Promise<RegionalStatsResponse> {
  const query = { from, to };
  switch (section) {
    case "mortality":
      return fetchRegionalMortality(token, query, viewAsInstitutionId);
    case "herd":
      return fetchRegionalHerd(token, query, viewAsInstitutionId);
    case "reproduction":
      return fetchRegionalReproduction(token, query, viewAsInstitutionId);
    case "growth":
      return fetchRegionalGrowth(token, query, viewAsInstitutionId);
    case "vetCoverage":
      return fetchRegionalVetCoverage(token, query, viewAsInstitutionId);
    case "economy":
      return fetchRegionalEconomy(token, query, viewAsInstitutionId);
    default:
      throw new Error(`Section non supportée : ${section}`);
  }
}

export function RegionalStatsSectionPanel({
  token,
  section,
  from,
  to
}: Props) {
  const t = useTranslations("stats.regional");
  const tSections = useTranslations("stats.regional.sections");
  const { viewAsInstitutionId } = useInstitutionPreview();
  const [data, setData] = useState<RegionalStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void fetchSection(token, section, from, to, viewAsInstitutionId)
      .then(setData)
      .catch(() => setError("loadError"))
      .finally(() => setLoading(false));
  }, [token, section, from, to, viewAsInstitutionId]);

  return (
    <AdminSection icon={Activity} title={tSections(section)} bare>
      {loading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{t("loadError")}</p>
      ) : data ? (
        <div className="space-y-4">
          <RegionalStatsCoverageBanner coverage={data.coverage} />
          <RegionalStatsDepartmentTable
            section={section}
            departments={data.departments}
          />
        </div>
      ) : null}
    </AdminSection>
  );
}
