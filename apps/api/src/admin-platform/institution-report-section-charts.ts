/**
 * Blocs graphiques PDF par section — miroir des visualisations écran (SVG pdfmake)
 * + lead méthodologique + analyse / interprétation chiffrée, localisés.
 */
import type { InstitutionStatSection } from "./institution-stats-sections.constants";
import type { InstitutionReportSectionData } from "./institution-report.constants";
import {
  chartInsights,
  labelProductionCategory,
  labelRecordKeys,
  reportI18n,
  type ReportLocale
} from "./institution-report.i18n";
import {
  buildBarChartSvg,
  buildDonutSvg,
  buildGaugeSvg,
  buildGroupedBarChartSvg,
  buildHorizontalRankSvg,
  buildProportionBarSvg,
  type ChartSegment
} from "../reports/templates/charts";
import { buildAnalysisBlock } from "../reports/templates/builders";
import { REPORT_COLORS } from "../reports/templates/palette";
import type { PdfContent } from "../reports/templates/pdf-types";

const CHART_W = 500;
const DONUT_COLORS = [
  REPORT_COLORS.primary,
  REPORT_COLORS.secondary,
  REPORT_COLORS.accent,
  REPORT_COLORS.success,
  REPORT_COLORS.danger,
  "#457B9D"
];

function visibleRows(
  departments: Record<string, unknown>[]
): Record<string, unknown>[] {
  return departments.filter((r) => r.masked !== true);
}

function shortDept(code: unknown): string {
  const s = String(code ?? "");
  return s.replace(/^CI-DEP-/, "").replace(/^CI-/, "");
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mergeJsonCounts(
  rows: Record<string, unknown>[],
  key: string
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const src = row[key];
    if (!src || typeof src !== "object" || Array.isArray(src)) continue;
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
      out[k] = (out[k] ?? 0) + num(v);
    }
  }
  return out;
}

function chartCaption(text: string): PdfContent {
  return {
    text,
    fontSize: 8,
    color: REPORT_COLORS.greyText,
    margin: [0, 0, 0, 6]
  };
}

function chartTitle(text: string): PdfContent {
  return {
    text,
    fontSize: 10,
    bold: true,
    color: REPORT_COLORS.accent,
    margin: [0, 8, 0, 4]
  };
}

function analysis(locale: ReportLocale, text: string): PdfContent {
  const title = reportI18n(locale).common.analysisTitle;
  const block = buildAnalysisBlock(text, title);
  if (block && typeof block === "object" && !Array.isArray(block)) {
    return { ...block, margin: [0, 0, 0, 12] };
  }
  return block;
}

function chartBlock(
  locale: ReportLocale,
  copy: { title: string; lead: string },
  viz: PdfContent | PdfContent[],
  insight: string
): PdfContent[] {
  return [
    chartTitle(copy.title),
    chartCaption(copy.lead),
    ...(Array.isArray(viz) ? viz : [viz]),
    analysis(locale, insight)
  ];
}

function toDonutSegments(
  rec: Record<string, number>,
  limit = 6
): ChartSegment[] {
  return Object.entries(rec)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value], i) => ({
      label,
      value,
      color: DONUT_COLORS[i % DONUT_COLORS.length]
    }));
}

function topOf(
  items: { label: string; value: number }[]
): { label: string; value: number } | undefined {
  if (items.length === 0) return undefined;
  return [...items].sort((a, b) => b.value - a.value)[0];
}

export function buildSectionCharts(
  section: InstitutionStatSection,
  data: InstitutionReportSectionData,
  locale: ReportLocale = "fr"
): PdfContent[] {
  const i18n = reportI18n(locale);
  const rows = visibleRows(data.departments);
  if (rows.length === 0) {
    return [
      {
        text: i18n.common.chartsUnavailable,
        fontSize: 8,
        italics: true,
        color: REPORT_COLORS.greyText,
        margin: [0, 0, 0, 10]
      }
    ];
  }

  switch (section) {
    case "mortality":
      return chartsMortality(rows, locale);
    case "herd":
      return chartsHerd(rows, locale);
    case "reproduction":
      return chartsReproduction(rows, locale);
    case "growth":
      return chartsGrowth(rows, locale);
    case "vetCoverage":
      return chartsVet(rows, locale);
    case "economy":
      return chartsEconomy(rows, locale);
    case "health":
      return chartsHealth(rows, locale);
    case "lifecycle":
      return chartsLifecycle(rows, locale);
    case "adoption":
      return chartsAdoption(rows, data.national, locale);
    default:
      return [];
  }
}

function chartsMortality(
  rows: Record<string, unknown>[],
  locale: ReportLocale
): PdfContent[] {
  const c = reportI18n(locale).charts.mortality;
  const rank = rows
    .map((r) => ({
      label: shortDept(r.departmentCode),
      value: num(r.mortalityHeadcount)
    }))
    .sort((a, b) => b.value - a.value);
  const causes = mergeJsonCounts(rows, "mortalityByCause");
  const donut = toDonutSegments(causes);
  const total = rank.reduce((s, d) => s + d.value, 0);

  return [
    ...chartBlock(
      locale,
      c.rank,
      {
        svg: buildHorizontalRankSvg(rank, CHART_W, 16, REPORT_COLORS.danger),
        width: CHART_W,
        margin: [0, 0, 0, 6]
      },
      chartInsights.topDept(
        locale,
        topOf(rank),
        "volume de mortalités",
        "mortality volume",
        locale === "en" ? "heads" : "têtes"
      )
    ),
    ...chartBlock(
      locale,
      c.causes,
      [
        {
          columns: [
            {
              svg: buildDonutSvg(donut, 120),
              width: 120,
              alignment: "center" as const
            },
            {
              stack: donut.map((s) => ({
                text: `${s.label} : ${s.value}`,
                fontSize: 8,
                margin: [0, 2, 0, 0]
              })),
              width: "*"
            }
          ],
          columnGap: 16,
          margin: [0, 0, 0, 6]
        },
        {
          svg: buildGaugeSvg(total, Math.max(total, 1), 100, REPORT_COLORS.danger),
          width: 100,
          alignment: "center" as const,
          margin: [0, 0, 0, 6]
        }
      ],
      chartInsights.dominantShare(locale, topOf(donut), total)
    )
  ];
}

function chartsHerd(
  rows: Record<string, unknown>[],
  locale: ReportLocale
): PdfContent[] {
  const c = reportI18n(locale).charts.herd;
  const byCatRaw = mergeJsonCounts(rows, "animalCountByCategory");
  const byCat = labelRecordKeys(byCatRaw, locale, labelProductionCategory);
  const donut = toDonutSegments(byCat);
  const bars = rows.map((r) => {
    const cats = r.animalCountByCategory;
    let herd = 0;
    if (cats && typeof cats === "object" && !Array.isArray(cats)) {
      herd = Object.values(cats as Record<string, number>).reduce(
        (s, n) => s + num(n),
        0
      );
    }
    return { label: shortDept(r.departmentCode), value: herd };
  });
  const total = Object.values(byCat).reduce((s, n) => s + n, 0);

  return [
    ...chartBlock(
      locale,
      c.bars,
      {
        svg: buildBarChartSvg(bars, CHART_W, 120, REPORT_COLORS.primary),
        width: CHART_W,
        margin: [0, 0, 0, 6]
      },
      chartInsights.topDept(
        locale,
        topOf(bars),
        "effectif suivi",
        "tracked herd",
        locale === "en" ? "animals" : "animaux"
      )
    ),
    ...chartBlock(
      locale,
      c.donut,
      {
        columns: [
          {
            svg: buildDonutSvg(donut, 120),
            width: 120,
            alignment: "center" as const
          },
          {
            stack: donut.map((s) => ({
              text: `${s.label} : ${s.value}`,
              fontSize: 8,
              margin: [0, 2, 0, 0]
            })),
            width: "*"
          }
        ],
        columnGap: 16,
        margin: [0, 0, 0, 6]
      },
      chartInsights.dominantShare(locale, topOf(donut), total)
    )
  ];
}

function chartsReproduction(
  rows: Record<string, unknown>[],
  locale: ReportLocale
): PdfContent[] {
  const i18n = reportI18n(locale);
  const c = i18n.charts.reproduction;
  const grouped = rows.map((r) => ({
    label: shortDept(r.departmentCode),
    a: num(r.bornAlive),
    b: num(r.stillborn)
  }));
  const born = grouped.reduce((s, g) => s + g.a, 0);
  const still = grouped.reduce((s, g) => s + g.b, 0);
  const completed = rows.reduce((s, r) => s + num(r.gestationsCompleted), 0);
  const lost =
    rows.reduce((s, r) => s + num(r.gestationsAborted), 0) +
    rows.reduce((s, r) => s + num(r.gestationsLost), 0);
  const iaRank = rows
    .map((r) => ({
      label: shortDept(r.departmentCode),
      value: num(r.partIA) * 100
    }))
    .sort((a, b) => b.value - a.value);

  return [
    ...chartBlock(
      locale,
      c.born,
      {
        svg: buildGroupedBarChartSvg(
          grouped,
          CHART_W,
          130,
          { a: c.seriesBorn, b: c.seriesStill },
          { a: REPORT_COLORS.success, b: REPORT_COLORS.secondary }
        ),
        width: CHART_W,
        margin: [0, 0, 0, 6]
      },
      chartInsights.bornVsStill(locale, born, still)
    ),
    ...chartBlock(
      locale,
      c.farrowing,
      completed + lost > 0
        ? {
            columns: [
              {
                svg: buildDonutSvg(
                  [
                    {
                      label: c.completed,
                      value: completed,
                      color: REPORT_COLORS.success
                    },
                    {
                      label: c.lost,
                      value: lost,
                      color: REPORT_COLORS.danger
                    }
                  ].filter((s) => s.value > 0),
                  110
                ),
                width: 120
              },
              {
                stack: [
                  {
                    text: `${c.completed} : ${completed}`,
                    fontSize: 9,
                    margin: [0, 8, 0, 0]
                  },
                  {
                    text: `${c.lost} : ${lost}`,
                    fontSize: 9,
                    margin: [0, 4, 0, 0]
                  }
                ],
                width: "*"
              }
            ],
            margin: [0, 0, 0, 6]
          }
        : {
            text: i18n.common.noGestations,
            fontSize: 8,
            italics: true,
            color: REPORT_COLORS.greyText,
            margin: [0, 0, 0, 6]
          },
      chartInsights.farrowing(locale, completed, lost)
    ),
    ...chartBlock(
      locale,
      c.ia,
      {
        svg: buildHorizontalRankSvg(iaRank, CHART_W, 16, REPORT_COLORS.accent),
        width: CHART_W,
        margin: [0, 0, 0, 6]
      },
      chartInsights.topDept(locale, topOf(iaRank), "part IA", "AI share", "%")
    )
  ];
}

function chartsGrowth(
  rows: Record<string, unknown>[],
  locale: ReportLocale
): PdfContent[] {
  const c = reportI18n(locale).charts.growth;
  const gmq = (r: Record<string, unknown>) => {
    const cats = r.avgGmqByCategory;
    if (!cats || typeof cats !== "object" || Array.isArray(cats)) return 0;
    const vals = Object.values(cats as Record<string, number>).map(num);
    return vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 0;
  };
  const bars = rows.map((r) => ({
    label: shortDept(r.departmentCode),
    value: Math.round(gmq(r) * 100) / 100
  }));
  const rank = [...bars].sort((a, b) => b.value - a.value);

  return [
    ...chartBlock(
      locale,
      c.bars,
      {
        svg: buildBarChartSvg(bars, CHART_W, 120, REPORT_COLORS.primary),
        width: CHART_W,
        margin: [0, 0, 0, 6]
      },
      chartInsights.topDept(
        locale,
        topOf(bars),
        "GMQ moyen",
        "average ADG",
        "kg/j"
      )
    ),
    ...chartBlock(
      locale,
      c.rank,
      {
        svg: buildHorizontalRankSvg(rank, CHART_W, 16, REPORT_COLORS.success),
        width: CHART_W,
        margin: [0, 0, 0, 6]
      },
      chartInsights.topDept(
        locale,
        topOf(rank),
        "GMQ",
        "ADG",
        locale === "en" ? "kg/d" : "kg/j"
      )
    )
  ];
}

function chartsVet(
  rows: Record<string, unknown>[],
  locale: ReportLocale
): PdfContent[] {
  const c = reportI18n(locale).charts.vetCoverage;
  const bars = rows.map((r) => ({
    label: shortDept(r.departmentCode),
    value: num(r.vetConsultationsCount)
  }));
  const donut = bars
    .filter((d) => d.value > 0)
    .map((d, i) => ({
      label: d.label,
      value: d.value,
      color: DONUT_COLORS[i % DONUT_COLORS.length]
    }));
  const perFarm = rows
    .map((r) => {
      const farms = num(r.farmCount);
      return {
        label: shortDept(r.departmentCode),
        value:
          farms > 0
            ? Math.round((num(r.vetConsultationsCount) / farms) * 10) / 10
            : 0
      };
    })
    .sort((a, b) => b.value - a.value);

  return [
    ...chartBlock(
      locale,
      c.consult,
      {
        columns: [
          { svg: buildDonutSvg(donut, 120), width: 120 },
          {
            svg: buildBarChartSvg(bars, 360, 120, REPORT_COLORS.accent),
            width: 360
          }
        ],
        columnGap: 12,
        margin: [0, 0, 0, 6]
      },
      chartInsights.topDept(
        locale,
        topOf(bars),
        "volume de consultations",
        "consultation volume"
      )
    ),
    ...chartBlock(
      locale,
      c.intensity,
      {
        svg: buildHorizontalRankSvg(perFarm, CHART_W, 16, REPORT_COLORS.primary),
        width: CHART_W,
        margin: [0, 0, 0, 6]
      },
      chartInsights.topDept(
        locale,
        topOf(perFarm),
        "intensité / ferme",
        "intensity per farm"
      )
    )
  ];
}

function chartsEconomy(
  rows: Record<string, unknown>[],
  locale: ReportLocale
): PdfContent[] {
  const c = reportI18n(locale).charts.economy;
  const grouped = rows.map((r) => ({
    label: shortDept(r.departmentCode),
    a: num(r.exitsSaleHeadcount),
    b: num(r.exitsSlaughterHeadcount)
  }));
  const sale = grouped.reduce((s, g) => s + g.a, 0);
  const slaughter = grouped.reduce((s, g) => s + g.b, 0);
  const sales = rows.map((r) => ({
    label: shortDept(r.departmentCode),
    value: num(r.exitsSaleHeadcount)
  }));

  return [
    ...chartBlock(
      locale,
      c.group,
      {
        svg: buildGroupedBarChartSvg(
          grouped,
          CHART_W,
          130,
          { a: c.seriesSale, b: c.seriesSlaughter },
          { a: REPORT_COLORS.success, b: REPORT_COLORS.accent }
        ),
        width: CHART_W,
        margin: [0, 0, 0, 6]
      },
      chartInsights.saleVsSlaughter(locale, sale, slaughter)
    ),
    ...chartBlock(
      locale,
      c.sales,
      {
        svg: buildBarChartSvg(sales, CHART_W, 110, REPORT_COLORS.success),
        width: CHART_W,
        margin: [0, 0, 0, 6]
      },
      chartInsights.topDept(
        locale,
        topOf(sales),
        "volume de ventes",
        "sales volume",
        locale === "en" ? "heads" : "têtes"
      )
    )
  ];
}

function chartsHealth(
  rows: Record<string, unknown>[],
  locale: ReportLocale
): PdfContent[] {
  const c = reportI18n(locale).charts.health;
  const rank = rows
    .map((r) => ({
      label: shortDept(r.departmentCode),
      value: num(r.incidencePerThousand)
    }))
    .sort((a, b) => b.value - a.value);
  const diagMap: Record<string, number> = {};
  for (const r of rows) {
    const list = r.suspicionsByDiagnosis;
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const key = String(o.diagnosis ?? "autre");
      diagMap[key] = (diagMap[key] ?? 0) + num(o.suspicionsDeclared);
    }
  }
  const donut = toDonutSegments(diagMap);
  const causes = mergeJsonCounts(rows, "mortalityByCause");
  const proportion = toDonutSegments(causes, 5);
  const diagTotal = donut.reduce((s, d) => s + d.value, 0);
  const causeTotal = proportion.reduce((s, d) => s + d.value, 0);

  return [
    ...chartBlock(
      locale,
      c.incidence,
      {
        svg: buildHorizontalRankSvg(rank, CHART_W, 16, REPORT_COLORS.danger),
        width: CHART_W,
        margin: [0, 0, 0, 6]
      },
      chartInsights.topDept(
        locale,
        topOf(rank),
        "incidence des suspicions",
        "suspicion incidence",
        "/1 000"
      )
    ),
    ...chartBlock(
      locale,
      c.diagnoses,
      {
        columns: [
          { svg: buildDonutSvg(donut, 120), width: 120 },
          {
            stack: donut.map((s) => ({
              text: `${s.label} : ${s.value}`,
              fontSize: 8,
              margin: [0, 2, 0, 0]
            })),
            width: "*"
          }
        ],
        margin: [0, 0, 0, 6]
      },
      chartInsights.dominantShare(locale, topOf(donut), diagTotal)
    ),
    ...chartBlock(
      locale,
      c.causes,
      {
        svg: buildProportionBarSvg(proportion, CHART_W, 32),
        width: CHART_W,
        margin: [0, 0, 0, 6]
      },
      chartInsights.dominantShare(locale, topOf(proportion), causeTotal)
    )
  ];
}

function chartsLifecycle(
  rows: Record<string, unknown>[],
  locale: ReportLocale
): PdfContent[] {
  const c = reportI18n(locale).charts.lifecycle;
  const exits = { sale: 0, slaughter: 0, mortality: 0, transfer: 0 };
  for (const r of rows) {
    const byKind = r.exitsByKind;
    if (byKind && typeof byKind === "object" && !Array.isArray(byKind)) {
      const o = byKind as Record<string, { headcount?: number }>;
      exits.sale += num(o.sale?.headcount);
      exits.slaughter += num(o.slaughter?.headcount);
      exits.mortality += num(o.mortality?.headcount);
      exits.transfer += num(o.transfer?.headcount);
    } else {
      exits.sale += num(r.exitsSaleHeadcount);
      exits.slaughter += num(r.exitsSlaughterHeadcount);
    }
  }
  const proportion: ChartSegment[] = [
    { label: c.kindSale, value: exits.sale, color: REPORT_COLORS.success },
    {
      label: c.kindSlaughter,
      value: exits.slaughter,
      color: REPORT_COLORS.accent
    },
    {
      label: c.kindMortality,
      value: exits.mortality,
      color: REPORT_COLORS.danger
    },
    {
      label: c.kindTransfer,
      value: exits.transfer,
      color: REPORT_COLORS.secondary
    }
  ];
  const rank = rows
    .map((r) => ({
      label: shortDept(r.departmentCode),
      value: num(r.tauxVenteCheptel) * 100
    }))
    .sort((a, b) => b.value - a.value);
  const saleShare = exits.sale;
  const other = exits.slaughter + exits.mortality + exits.transfer;

  return [
    ...chartBlock(
      locale,
      c.exits,
      {
        svg: buildProportionBarSvg(proportion, CHART_W, 32),
        width: CHART_W,
        margin: [0, 0, 0, 6]
      },
      chartInsights.exitMix(
        locale,
        proportion.map((p) => ({ label: p.label, value: p.value }))
      )
    ),
    ...chartBlock(
      locale,
      c.saleShare,
      {
        columns: [
          {
            svg: buildDonutSvg(
              [
                {
                  label: c.kindSale,
                  value: saleShare,
                  color: REPORT_COLORS.success
                },
                {
                  label: c.otherExits,
                  value: other,
                  color: REPORT_COLORS.border
                }
              ].filter((s) => s.value > 0),
              110
            ),
            width: 120
          },
          {
            stack: [
              chartCaption(c.saleRateRank),
              {
                svg: buildHorizontalRankSvg(
                  rank,
                  360,
                  16,
                  REPORT_COLORS.success
                ),
                width: 360
              }
            ],
            width: "*"
          }
        ],
        margin: [0, 0, 0, 6]
      },
      chartInsights.topDept(
        locale,
        topOf(rank),
        "taux de vente",
        "sale rate",
        "%"
      )
    )
  ];
}

function chartsAdoption(
  rows: Record<string, unknown>[],
  national: Record<string, unknown> | undefined,
  locale: ReportLocale
): PdfContent[] {
  const c = reportI18n(locale).charts.adoption;
  const bars = rows.map((r) => ({
    label: shortDept(r.departmentCode),
    value: num(r.activeFarmsCount)
  }));
  const roles = mergeJsonCounts(rows, "activeUsersByRole");
  const donut = toDonutSegments(roles);
  const r30 = num(national?.retentionJ30) * 100;
  const r90 = num(national?.retentionJ90) * 100;
  const r30Txt = r30 > 0 ? `${r30.toFixed(0)} %` : "—";
  const r90Txt = r90 > 0 ? `${r90.toFixed(0)} %` : "—";

  return [
    ...chartBlock(
      locale,
      c.farms,
      {
        svg: buildBarChartSvg(bars, CHART_W, 120, REPORT_COLORS.primary),
        width: CHART_W,
        margin: [0, 0, 0, 6]
      },
      chartInsights.topDept(
        locale,
        topOf(bars),
        "nombre de fermes actives",
        "active farm count"
      )
    ),
    ...chartBlock(
      locale,
      c.roles,
      {
        columns: [
          { svg: buildDonutSvg(donut, 120), width: 120 },
          {
            stack: [
              ...donut.map((s) => ({
                text: `${s.label} : ${s.value}`,
                fontSize: 8,
                margin: [0, 2, 0, 0] as [number, number, number, number]
              })),
              {
                text: c.retention(r30Txt, r90Txt),
                fontSize: 8,
                margin: [0, 10, 0, 0] as [number, number, number, number],
                color: REPORT_COLORS.greyText
              }
            ],
            width: "*"
          }
        ],
        margin: [0, 0, 0, 6]
      },
      `${chartInsights.dominantShare(
        locale,
        topOf(donut),
        donut.reduce((s, d) => s + d.value, 0)
      )} ${chartInsights.retention(locale, r30, r90)}`
    )
  ];
}

/** Séries d’analyse pour le CSV ZIP (localisées) — miroir des blocs PDF. */
export function sectionChartAnalyses(
  section: InstitutionReportSectionData,
  locale: ReportLocale
): Array<{
  section: string;
  chart: string;
  lead: string;
  analysis: string;
}> {
  const rows = visibleRows(section.departments);
  if (rows.length === 0) return [];
  const i18n = reportI18n(locale);
  const out: Array<{
    section: string;
    chart: string;
    lead: string;
    analysis: string;
  }> = [];
  const push = (copy: { title: string; lead: string }, insight: string) => {
    out.push({
      section: section.section,
      chart: copy.title,
      lead: copy.lead,
      analysis: insight
    });
  };

  switch (section.section) {
    case "mortality": {
      const rank = rows.map((r) => ({
        label: shortDept(r.departmentCode),
        value: num(r.mortalityHeadcount)
      }));
      const causes = toDonutSegments(mergeJsonCounts(rows, "mortalityByCause"));
      push(
        i18n.charts.mortality.rank,
        chartInsights.topDept(
          locale,
          topOf(rank),
          "volume de mortalités",
          "mortality volume"
        )
      );
      push(
        i18n.charts.mortality.causes,
        chartInsights.dominantShare(
          locale,
          topOf(causes),
          causes.reduce((s, d) => s + d.value, 0)
        )
      );
      break;
    }
    case "herd": {
      const bars = rows.map((r) => {
        const cats = r.animalCountByCategory;
        let herd = 0;
        if (cats && typeof cats === "object" && !Array.isArray(cats)) {
          herd = Object.values(cats as Record<string, number>).reduce(
            (s, n) => s + num(n),
            0
          );
        }
        return { label: shortDept(r.departmentCode), value: herd };
      });
      const byCat = labelRecordKeys(
        mergeJsonCounts(rows, "animalCountByCategory"),
        locale
      );
      const donut = toDonutSegments(byCat);
      push(
        i18n.charts.herd.bars,
        chartInsights.topDept(
          locale,
          topOf(bars),
          "effectif suivi",
          "tracked herd"
        )
      );
      push(
        i18n.charts.herd.donut,
        chartInsights.dominantShare(
          locale,
          topOf(donut),
          donut.reduce((s, d) => s + d.value, 0)
        )
      );
      break;
    }
    case "reproduction": {
      const born = rows.reduce((s, r) => s + num(r.bornAlive), 0);
      const still = rows.reduce((s, r) => s + num(r.stillborn), 0);
      const completed = rows.reduce((s, r) => s + num(r.gestationsCompleted), 0);
      const lost =
        rows.reduce((s, r) => s + num(r.gestationsAborted), 0) +
        rows.reduce((s, r) => s + num(r.gestationsLost), 0);
      const iaRank = rows.map((r) => ({
        label: shortDept(r.departmentCode),
        value: num(r.partIA) * 100
      }));
      push(
        i18n.charts.reproduction.born,
        chartInsights.bornVsStill(locale, born, still)
      );
      push(
        i18n.charts.reproduction.farrowing,
        chartInsights.farrowing(locale, completed, lost)
      );
      push(
        i18n.charts.reproduction.ia,
        chartInsights.topDept(locale, topOf(iaRank), "part IA", "AI share", "%")
      );
      break;
    }
    case "economy": {
      const sale = rows.reduce((s, r) => s + num(r.exitsSaleHeadcount), 0);
      const slaughter = rows.reduce(
        (s, r) => s + num(r.exitsSlaughterHeadcount),
        0
      );
      push(
        i18n.charts.economy.group,
        chartInsights.saleVsSlaughter(locale, sale, slaughter)
      );
      break;
    }
    case "health": {
      const rank = rows.map((r) => ({
        label: shortDept(r.departmentCode),
        value: num(r.incidencePerThousand)
      }));
      push(
        i18n.charts.health.incidence,
        chartInsights.topDept(
          locale,
          topOf(rank),
          "incidence des suspicions",
          "suspicion incidence",
          "/1 000"
        )
      );
      break;
    }
    case "lifecycle": {
      const exits = { sale: 0, slaughter: 0, mortality: 0, transfer: 0 };
      for (const r of rows) {
        exits.sale += num(r.exitsSaleHeadcount);
        exits.slaughter += num(r.exitsSlaughterHeadcount);
      }
      const c = i18n.charts.lifecycle;
      push(
        c.exits,
        chartInsights.exitMix(locale, [
          { label: c.kindSale, value: exits.sale },
          { label: c.kindSlaughter, value: exits.slaughter },
          { label: c.kindMortality, value: exits.mortality },
          { label: c.kindTransfer, value: exits.transfer }
        ])
      );
      break;
    }
    case "adoption": {
      const bars = rows.map((r) => ({
        label: shortDept(r.departmentCode),
        value: num(r.activeFarmsCount)
      }));
      push(
        i18n.charts.adoption.farms,
        chartInsights.topDept(
          locale,
          topOf(bars),
          "nombre de fermes actives",
          "active farm count"
        )
      );
      break;
    }
    default:
      break;
  }
  return out;
}
