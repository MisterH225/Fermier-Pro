"use client";

import { useTranslations } from "next-intl";
import type { InstitutionStatSection } from "@/lib/institution-stat-sections";
import type { RegionalStatsDepartmentRow } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type Props = {
  section: InstitutionStatSection;
  departments: RegionalStatsDepartmentRow[];
};

function formatMasked(t: ReturnType<typeof useTranslations<"stats.regional">>) {
  return t("maskedValue");
}

function formatJsonRecord(
  value: Record<string, number> | undefined,
  masked: boolean | undefined,
  t: ReturnType<typeof useTranslations<"stats.regional">>
) {
  if (masked || !value || Object.keys(value).length === 0) {
    return formatMasked(t);
  }
  return Object.entries(value)
    .map(([key, count]) => `${key}: ${count}`)
    .join(" · ");
}

export function RegionalStatsDepartmentTable({ section, departments }: Props) {
  const t = useTranslations("stats.regional");

  if (departments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">{t("noDepartments")}</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.department")}</TableHead>
            <TableHead>{t("columns.farms")}</TableHead>
            {section === "mortality" ? (
              <>
                <TableHead>{t("columns.mortality")}</TableHead>
                <TableHead>{t("columns.byCause")}</TableHead>
                <TableHead>{t("columns.zScore")}</TableHead>
              </>
            ) : null}
            {section === "herd" ? (
              <>
                <TableHead>{t("columns.herdByCategory")}</TableHead>
                <TableHead>{t("columns.exitsSale")}</TableHead>
                <TableHead>{t("columns.exitsSlaughter")}</TableHead>
              </>
            ) : null}
            {section === "reproduction" ? (
              <>
                <TableHead>{t("columns.litters")}</TableHead>
                <TableHead>{t("columns.bornAlive")}</TableHead>
                <TableHead>{t("columns.stillborn")}</TableHead>
                <TableHead>{t("columns.weaned")}</TableHead>
                <TableHead>{t("columns.tauxMiseBas")}</TableHead>
                <TableHead>{t("columns.tauxMortNes")}</TableHead>
                <TableHead>{t("columns.tauxPertesGestation")}</TableHead>
                <TableHead>{t("columns.partIA")}</TableHead>
              </>
            ) : null}
            {section === "growth" ? (
              <>
                <TableHead>{t("columns.gmq")}</TableHead>
                <TableHead>{t("columns.salePrice")}</TableHead>
              </>
            ) : null}
            {section === "vetCoverage" ? (
              <TableHead>{t("columns.vetConsultations")}</TableHead>
            ) : null}
            {section === "economy" ? (
              <>
                <TableHead>{t("columns.exitsSale")}</TableHead>
                <TableHead>{t("columns.salePrice")}</TableHead>
                <TableHead>{t("columns.exitsSlaughter")}</TableHead>
              </>
            ) : null}
            {section === "health" ? (
              <>
                <TableHead>{t("columns.suspicionsDeclared")}</TableHead>
                <TableHead>{t("columns.incidence")}</TableHead>
                <TableHead>{t("columns.letaliteApparente")}</TableHead>
                <TableHead>{t("columns.byCause")}</TableHead>
              </>
            ) : null}
            {section === "lifecycle" ? (
              <>
                <TableHead>{t("columns.tauxVente")}</TableHead>
                <TableHead>{t("columns.avgAgeSale")}</TableHead>
                <TableHead>{t("columns.exitsSale")}</TableHead>
              </>
            ) : null}
            {section === "adoption" ? (
              <>
                <TableHead>{t("columns.activeFarms")}</TableHead>
              </>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {departments.map((row) => {
            const masked = row.masked === true;
            return (
              <TableRow key={row.departmentCode}>
                <TableCell className="font-medium">{row.departmentCode}</TableCell>
                <TableCell>{row.farmCount}</TableCell>
                {section === "mortality" ? (
                  <>
                    <TableCell>
                      {masked ? formatMasked(t) : (row.mortalityHeadcount ?? "—")}
                    </TableCell>
                    <TableCell>
                      {formatJsonRecord(row.mortalityByCause, masked, t)}
                    </TableCell>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : row.zScore != null
                          ? row.zScore.toFixed(2)
                          : "—"}
                    </TableCell>
                  </>
                ) : null}
                {section === "herd" ? (
                  <>
                    <TableCell>
                      {formatJsonRecord(row.animalCountByCategory, masked, t)}
                    </TableCell>
                    <TableCell>
                      {masked ? formatMasked(t) : (row.exitsSaleHeadcount ?? "—")}
                    </TableCell>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : (row.exitsSlaughterHeadcount ?? "—")}
                    </TableCell>
                  </>
                ) : null}
                {section === "reproduction" ? (
                  <>
                    <TableCell>
                      {masked ? formatMasked(t) : (row.littersCount ?? "—")}
                    </TableCell>
                    <TableCell>
                      {masked ? formatMasked(t) : (row.bornAlive ?? "—")}
                    </TableCell>
                    <TableCell>
                      {masked ? formatMasked(t) : (row.stillborn ?? "—")}
                    </TableCell>
                    <TableCell>
                      {masked ? formatMasked(t) : (row.weanedEstimate ?? "—")}
                    </TableCell>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : row.tauxMiseBas != null
                          ? `${(row.tauxMiseBas * 100).toFixed(1)} %`
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : row.tauxMortNes != null
                          ? `${(row.tauxMortNes * 100).toFixed(1)} %`
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : row.tauxPertesGestation != null
                          ? `${(row.tauxPertesGestation * 100).toFixed(1)} %`
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : row.partIA != null
                          ? `${(row.partIA * 100).toFixed(1)} %`
                          : "—"}
                    </TableCell>
                  </>
                ) : null}
                {section === "growth" ? (
                  <>
                    <TableCell>
                      {formatJsonRecord(row.avgGmqByCategory, masked, t)}
                    </TableCell>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : row.exitsSaleAvgPricePerKg != null
                          ? row.exitsSaleAvgPricePerKg
                          : "—"}
                    </TableCell>
                  </>
                ) : null}
                {section === "vetCoverage" ? (
                  <TableCell>
                    {masked ? formatMasked(t) : (row.vetConsultationsCount ?? "—")}
                  </TableCell>
                ) : null}
                {section === "economy" ? (
                  <>
                    <TableCell>
                      {masked ? formatMasked(t) : (row.exitsSaleHeadcount ?? "—")}
                    </TableCell>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : row.exitsSaleAvgPricePerKg != null
                          ? row.exitsSaleAvgPricePerKg
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : (row.exitsSlaughterHeadcount ?? "—")}
                    </TableCell>
                  </>
                ) : null}
                {section === "health" ? (
                  <>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : (row.totalSuspicionsDeclared ?? "—")}
                    </TableCell>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : row.incidencePerThousand != null
                          ? row.incidencePerThousand
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : row.letaliteApparenteDeclarative != null
                          ? `${(row.letaliteApparenteDeclarative * 100).toFixed(1)} %`
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {formatJsonRecord(row.mortalityByCause, masked, t)}
                    </TableCell>
                  </>
                ) : null}
                {section === "lifecycle" ? (
                  <>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : row.tauxVenteCheptel != null
                          ? `${(row.tauxVenteCheptel * 100).toFixed(1)} %`
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {masked
                        ? formatMasked(t)
                        : row.avgAgeAtSaleDays != null
                          ? row.avgAgeAtSaleDays
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {masked ? formatMasked(t) : (row.exitsSaleHeadcount ?? "—")}
                    </TableCell>
                  </>
                ) : null}
                {section === "adoption" ? (
                  <TableCell>
                    {masked ? formatMasked(t) : (row.activeFarmsCount ?? "—")}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
