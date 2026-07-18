/**
 * Blocs graphiques PDF par section — miroir des visualisations écran (SVG pdfmake).
 */
import type { InstitutionStatSection } from "./institution-stats-sections.constants";
import type { InstitutionReportSectionData } from "./institution-report.constants";
import {
  buildBarChartSvg,
  buildDonutSvg,
  buildGaugeSvg,
  buildGroupedBarChartSvg,
  buildHorizontalRankSvg,
  buildProportionBarSvg,
  type ChartSegment
} from "../reports/templates/charts";
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

function toDonutSegments(rec: Record<string, number>, limit = 6): ChartSegment[] {
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

export function buildSectionCharts(
  section: InstitutionStatSection,
  data: InstitutionReportSectionData
): PdfContent[] {
  const rows = visibleRows(data.departments);
  if (rows.length === 0) {
    return [
      {
        text: "Graphiques indisponibles (données masquées ou absentes).",
        fontSize: 8,
        italics: true,
        color: REPORT_COLORS.greyText,
        margin: [0, 0, 0, 10]
      }
    ];
  }

  switch (section) {
    case "mortality":
      return chartsMortality(rows);
    case "herd":
      return chartsHerd(rows);
    case "reproduction":
      return chartsReproduction(rows);
    case "growth":
      return chartsGrowth(rows);
    case "vetCoverage":
      return chartsVet(rows);
    case "economy":
      return chartsEconomy(rows);
    case "health":
      return chartsHealth(rows);
    case "lifecycle":
      return chartsLifecycle(rows);
    case "adoption":
      return chartsAdoption(rows, data.national);
    default:
      return [];
  }
}

function chartsMortality(rows: Record<string, unknown>[]): PdfContent[] {
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
    chartTitle("Mortalités par département"),
    chartCaption(
      "Classement des têtes sorties pour mortalité — compare les départements entre eux."
    ),
    {
      svg: buildHorizontalRankSvg(rank, CHART_W, 16, REPORT_COLORS.danger),
      width: CHART_W,
      margin: [0, 0, 0, 10]
    },
    chartTitle("Répartition des causes déclarées"),
    chartCaption("Parts des causes agrégées sur la période."),
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
      margin: [0, 0, 0, 8]
    },
    {
      svg: buildGaugeSvg(total, Math.max(total, 1), 100, REPORT_COLORS.danger),
      width: 100,
      alignment: "center" as const,
      margin: [0, 0, 0, 12]
    }
  ];
}

function chartsHerd(rows: Record<string, unknown>[]): PdfContent[] {
  const byCat = mergeJsonCounts(rows, "animalCountByCategory");
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

  return [
    chartTitle("Effectif par département"),
    chartCaption("Cheptel suivi sur le panel — pas un recensement officiel."),
    {
      svg: buildBarChartSvg(bars, CHART_W, 120, REPORT_COLORS.primary),
      width: CHART_W,
      margin: [0, 0, 0, 10]
    },
    chartTitle("Répartition par catégorie de production"),
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
      margin: [0, 0, 0, 12]
    }
  ];
}

function chartsReproduction(rows: Record<string, unknown>[]): PdfContent[] {
  const grouped = rows.map((r) => ({
    label: shortDept(r.departmentCode),
    a: num(r.bornAlive),
    b: num(r.stillborn)
  }));
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
    chartTitle("Nés vivants vs mort-nés"),
    chartCaption(
      "Volumes déclarés via les portées — un volume bas peut refléter une faible saisie."
    ),
    {
      svg: buildGroupedBarChartSvg(
        grouped,
        CHART_W,
        130,
        { a: "Nés vivants", b: "Mort-nés" },
        { a: REPORT_COLORS.success, b: REPORT_COLORS.secondary }
      ),
      width: CHART_W,
      margin: [0, 0, 0, 10]
    },
    chartTitle("Issue des gestations"),
    chartCaption("Mises bas réussies vs pertes (avortements + lost)."),
    ...(completed + lost > 0
      ? [
          {
            columns: [
              {
                svg: buildDonutSvg(
                  [
                    {
                      label: "Mises bas",
                      value: completed,
                      color: REPORT_COLORS.success
                    },
                    {
                      label: "Pertes",
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
                    text: `Mises bas : ${completed}`,
                    fontSize: 9,
                    margin: [0, 8, 0, 0]
                  },
                  {
                    text: `Pertes : ${lost}`,
                    fontSize: 9,
                    margin: [0, 4, 0, 0]
                  }
                ],
                width: "*"
              }
            ],
            margin: [0, 0, 0, 10]
          } as PdfContent
        ]
      : [
          {
            text: "Aucune gestation terminée sur la période.",
            fontSize: 8,
            italics: true,
            color: REPORT_COLORS.greyText,
            margin: [0, 0, 0, 10]
          } as PdfContent
        ]),
    chartTitle("Part d’insémination artificielle (%)"),
    {
      svg: buildHorizontalRankSvg(iaRank, CHART_W, 16, REPORT_COLORS.accent),
      width: CHART_W,
      margin: [0, 0, 0, 12]
    }
  ];
}

function chartsGrowth(rows: Record<string, unknown>[]): PdfContent[] {
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
    chartTitle("GMQ moyen par département (kg/j)"),
    chartCaption("Estimé à partir des pesées successives."),
    {
      svg: buildBarChartSvg(bars, CHART_W, 120, REPORT_COLORS.primary),
      width: CHART_W,
      margin: [0, 0, 0, 10]
    },
    chartTitle("Classement GMQ"),
    {
      svg: buildHorizontalRankSvg(rank, CHART_W, 16, REPORT_COLORS.success),
      width: CHART_W,
      margin: [0, 0, 0, 12]
    }
  ];
}

function chartsVet(rows: Record<string, unknown>[]): PdfContent[] {
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
    chartTitle("Consultations vétérinaires"),
    chartCaption("Accès aux soins déclaré — pas la couverture vaccinale."),
    {
      columns: [
        {
          svg: buildDonutSvg(donut, 120),
          width: 120
        },
        {
          svg: buildBarChartSvg(bars, 360, 120, REPORT_COLORS.accent),
          width: 360
        }
      ],
      columnGap: 12,
      margin: [0, 0, 0, 10]
    },
    chartTitle("Intensité / ferme"),
    {
      svg: buildHorizontalRankSvg(perFarm, CHART_W, 16, REPORT_COLORS.primary),
      width: CHART_W,
      margin: [0, 0, 0, 12]
    }
  ];
}

function chartsEconomy(rows: Record<string, unknown>[]): PdfContent[] {
  const grouped = rows.map((r) => ({
    label: shortDept(r.departmentCode),
    a: num(r.exitsSaleHeadcount),
    b: num(r.exitsSlaughterHeadcount)
  }));
  const sales = rows.map((r) => ({
    label: shortDept(r.departmentCode),
    value: num(r.exitsSaleHeadcount)
  }));

  return [
    chartTitle("Vente vs abattage"),
    chartCaption("Sorties commerciales et d’abattage déclarées."),
    {
      svg: buildGroupedBarChartSvg(
        grouped,
        CHART_W,
        130,
        { a: "Vente", b: "Abattage" },
        { a: REPORT_COLORS.success, b: REPORT_COLORS.accent }
      ),
      width: CHART_W,
      margin: [0, 0, 0, 10]
    },
    chartTitle("Têtes vendues par département"),
    {
      svg: buildBarChartSvg(sales, CHART_W, 110, REPORT_COLORS.success),
      width: CHART_W,
      margin: [0, 0, 0, 12]
    }
  ];
}

function chartsHealth(rows: Record<string, unknown>[]): PdfContent[] {
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

  return [
    chartTitle("Incidence des suspicions / 1 000"),
    chartCaption(
      "Classement par incidence (pas par volume brut). Suspicions déclarées — non confirmées labo."
    ),
    {
      svg: buildHorizontalRankSvg(rank, CHART_W, 16, REPORT_COLORS.danger),
      width: CHART_W,
      margin: [0, 0, 0, 10]
    },
    chartTitle("Top diagnostics déclarés"),
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
      margin: [0, 0, 0, 10]
    },
    chartTitle("Causes de mortalité associées"),
    chartCaption("Corrélation déclarative uniquement."),
    {
      svg: buildProportionBarSvg(proportion, CHART_W, 32),
      width: CHART_W,
      margin: [0, 0, 0, 12]
    }
  ];
}

function chartsLifecycle(rows: Record<string, unknown>[]): PdfContent[] {
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
    { label: "Vente", value: exits.sale, color: REPORT_COLORS.success },
    { label: "Abattage", value: exits.slaughter, color: REPORT_COLORS.accent },
    { label: "Mortalité", value: exits.mortality, color: REPORT_COLORS.danger },
    { label: "Transfert", value: exits.transfer, color: REPORT_COLORS.secondary }
  ];
  const rank = rows
    .map((r) => ({
      label: shortDept(r.departmentCode),
      value: num(r.tauxVenteCheptel) * 100
    }))
    .sort((a, b) => b.value - a.value);
  const saleShare = exits.sale;
  const other =
    exits.slaughter + exits.mortality + exits.transfer;

  return [
    chartTitle("Où vont les porcs ?"),
    chartCaption("Répartition des sorties déclarées."),
    {
      svg: buildProportionBarSvg(proportion, CHART_W, 32),
      width: CHART_W,
      margin: [0, 0, 0, 10]
    },
    chartTitle("Part des ventes parmi les sorties"),
    {
      columns: [
        {
          svg: buildDonutSvg(
            [
              {
                label: "Vente",
                value: saleShare,
                color: REPORT_COLORS.success
              },
              { label: "Autres", value: other, color: REPORT_COLORS.border }
            ].filter((s) => s.value > 0),
            110
          ),
          width: 120
        },
        {
          stack: [
            chartCaption("Taux de vente du cheptel par département (%)"),
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
      margin: [0, 0, 0, 12]
    }
  ];
}

function chartsAdoption(
  rows: Record<string, unknown>[],
  national?: Record<string, unknown>
): PdfContent[] {
  const bars = rows.map((r) => ({
    label: shortDept(r.departmentCode),
    value: num(r.activeFarmsCount)
  }));
  const roles = mergeJsonCounts(rows, "activeUsersByRole");
  const donut = toDonutSegments(roles);
  const r30 = num(national?.retentionJ30) * 100;
  const r90 = num(national?.retentionJ90) * 100;

  return [
    chartTitle("Fermes actives (fenêtre 30 j)"),
    chartCaption(
      "Fermes avec ≥ 1 saisie récente — mesure d’adoption plus stricte que le MAU."
    ),
    {
      svg: buildBarChartSvg(bars, CHART_W, 120, REPORT_COLORS.primary),
      width: CHART_W,
      margin: [0, 0, 0, 10]
    },
    chartTitle("Utilisateurs actifs par rôle"),
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
              text: `Rétention J+30 : ${r30 > 0 ? `${r30.toFixed(0)} %` : "—"} · J+90 : ${r90 > 0 ? `${r90.toFixed(0)} %` : "—"}`,
              fontSize: 8,
              margin: [0, 10, 0, 0] as [number, number, number, number],
              color: REPORT_COLORS.greyText
            }
          ],
          width: "*"
        }
      ],
      margin: [0, 0, 0, 12]
    }
  ];
}
