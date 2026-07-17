"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import {
  generateInstitutionStatsReport,
  triggerInstitutionStatsReportDownload,
  type InstitutionStatsReportFormat
} from "@/lib/api";
import type { InstitutionStatSection } from "@/lib/institution-stat-sections";
import { Button } from "@/components/ui/button";

type Props = {
  token: string;
  sections: InstitutionStatSection[];
  from: string;
  to: string;
  viewAsInstitutionId?: string | null;
};

export function RegionalStatsExportButton({
  token,
  sections,
  from,
  to,
  viewAsInstitutionId
}: Props) {
  const t = useTranslations("stats.regional.export");
  const [busyFormat, setBusyFormat] = useState<InstitutionStatsReportFormat | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const exportReport = async (format: InstitutionStatsReportFormat) => {
    if (sections.length === 0 || busyFormat) return;
    setBusyFormat(format);
    setError(null);
    try {
      const result = await generateInstitutionStatsReport(
        token,
        { sections, from, to, format },
        viewAsInstitutionId
      );
      triggerInstitutionStatsReportDownload(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusyFormat(null);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sections.length === 0 || busyFormat !== null}
          onClick={() => void exportReport("pdf")}
        >
          <Download className="h-4 w-4" aria-hidden />
          {busyFormat === "pdf" ? t("exporting") : t("exportPdf")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sections.length === 0 || busyFormat !== null}
          onClick={() => void exportReport("csv")}
        >
          <Download className="h-4 w-4" aria-hidden />
          {busyFormat === "csv" ? t("exporting") : t("exportCsv")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
