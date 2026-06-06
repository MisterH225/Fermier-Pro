import type { PdfContent, PdfDocumentDefinitions } from "./pdf-types";
import {
  buildDataTable,
  buildDivider,
  buildInfographicBlock,
  buildKpiCard,
  buildKpiRow,
  buildPageFooter,
  buildProgressBar,
  buildRecommendationCard,
  buildSectionHeader,
  buildTwoColumnLayout
} from "./builders";
import {
  buildBarChartSvg,
  buildDonutSvg,
  buildGaugeSvg,
  buildHorizontalBarSvg
} from "./charts";
import {
  formatFcfa,
  formatPct,
  formatPeriodLabel,
  periodTypeBadge,
  riskLevelLabel,
  scoreInterpretation
} from "./formatters";
import type { FarmReportPdfContext } from "./farm-report.types";
import { REPORT_COLORS, REPORT_MARGINS, REPORT_TYPO } from "./palette";

function fin(ctx: FarmReportPdfContext) {
  return (ctx.sections.finance ?? {}) as Record<string, unknown>;
}

function cheptel(ctx: FarmReportPdfContext) {
  return (ctx.sections.cheptel ?? {}) as Record<string, unknown>;
}

function health(ctx: FarmReportPdfContext) {
  return (ctx.sections.health ?? {}) as Record<string, unknown>;
}

function feed(ctx: FarmReportPdfContext) {
  return (ctx.sections.feed ?? {}) as Record<string, unknown>;
}

function gestation(ctx: FarmReportPdfContext) {
  return (ctx.sections.gestation ?? {}) as Record<string, unknown>;
}

function pageCover(ctx: FarmReportPdfContext): PdfContent[] {
  const finSec = fin(ctx);
  const cur = (finSec.current as { totals?: { revenues: string; expenses: string } })?.totals;
  const rev = Number(cur?.revenues ?? 0);
  const periodLabel = formatPeriodLabel(ctx.periodType, ctx.periodStart, ctx.periodEnd);

  return [
    {
      canvas: [
        { type: "rect", x: 0, y: 0, w: 555, h: 280, color: REPORT_COLORS.primary }
      ],
      absolutePosition: { x: REPORT_MARGINS.left, y: REPORT_MARGINS.top }
    },
    {
      absolutePosition: { x: REPORT_MARGINS.left + 12, y: REPORT_MARGINS.top + 12 },
      columns: [
        { text: "FermierPro", color: REPORT_COLORS.white, fontSize: 12, bold: true, width: "*" },
        {
          text: periodTypeBadge(ctx.periodType),
          color: REPORT_COLORS.white,
          fontSize: 8,
          alignment: "right",
          background: REPORT_COLORS.accent,
          margin: [0, 2, 0, 0]
        }
      ],
      width: 515
    },
    {
      absolutePosition: { x: REPORT_MARGINS.left, y: REPORT_MARGINS.top + 80 },
      stack: [
        {
          text: "RAPPORT D'EXPLOITATION AGRICOLE",
          color: REPORT_COLORS.white,
          fontSize: REPORT_TYPO.h1,
          bold: true,
          alignment: "center"
        },
        { text: periodLabel, color: REPORT_COLORS.white, fontSize: REPORT_TYPO.h2, alignment: "center", margin: [0, 8, 0, 0] }
      ],
      width: 555
    },
    {
      margin: [0, 300, 0, 0],
      stack: [
        {
          canvas: [
            { type: "ellipse", x: 277, y: 40, r1: 36, r2: 36, color: REPORT_COLORS.lightBg }
          ]
        },
        { text: "🌾", fontSize: 28, alignment: "center", margin: [0, -52, 0, 8] },
        { text: ctx.ownerName, fontSize: 18, bold: true, alignment: "center" },
        { text: ctx.farmName, fontSize: REPORT_TYPO.h2, alignment: "center", color: REPORT_COLORS.greyText, margin: [0, 4, 0, 0] },
        {
          text: `📍 ${ctx.address?.trim() || "Localisation non renseignée"}`,
          fontSize: REPORT_TYPO.body,
          alignment: "center",
          color: REPORT_COLORS.greyText,
          margin: [0, 4, 0, 16]
        },
        {
          columns: [
            buildKpiCard("Cheptel total", String(ctx.cheptelCategories.total), "têtes", REPORT_COLORS.primary),
            buildKpiCard("Revenu période", formatFcfa(rev).replace(" FCFA", ""), "FCFA", REPORT_COLORS.secondary),
            buildKpiCard("Score ferme", String(ctx.scoreGlobal), "/100", REPORT_COLORS.success)
          ],
          columnGap: 8
        },
        {
          margin: [0, 24, 0, 0],
          table: {
            widths: ["*"],
            body: [[{ text: `Généré par FermierPro — ${new Date(ctx.generatedAt).toLocaleDateString("fr-FR")} · ${ctx.reportRef}`, style: "small", alignment: "center" }]]
          },
          layout: "noBorders"
        },
        {
          text: "Document confidentiel — à usage bancaire et financier",
          style: "footer",
          alignment: "center",
          margin: [0, 8, 0, 0]
        }
      ]
    }
  ];
}

function pageFinance(ctx: FarmReportPdfContext): PdfContent[] {
  const finSec = fin(ctx);
  const cur = (finSec.current as { totals?: { revenues: string; expenses: string } })?.totals;
  const rev = Number(cur?.revenues ?? 0);
  const exp = Number(cur?.expenses ?? 0);
  const net = rev - exp;
  const trend = (finSec.monthlyTrend ?? []) as Array<{ month: string; revenues: string }>;
  const barData = trend.slice(-6).map((r) => ({
    label: r.month.length > 6 ? r.month.slice(5) : r.month,
    value: Number(r.revenues)
  }));
  const topRev = (finSec.topRevenues ?? []) as Array<{ label: string; revenues: number }>;
  const revSegments = topRev.length
    ? topRev.map((r, i) => ({
        label: r.label,
        value: r.revenues,
        color: [REPORT_COLORS.primary, REPORT_COLORS.secondary, REPORT_COLORS.accent][i % 3]
      }))
    : [{ label: "Revenus", value: rev || 1, color: REPORT_COLORS.primary }];

  const left: PdfContent[] = [
    buildSectionHeader("Synthèse financière"),
    { svg: buildBarChartSvg(barData, 280, 100), width: 280, margin: [0, 0, 0, 8] },
    buildKpiRow("Revenus totaux période", formatFcfa(rev), REPORT_COLORS.success),
    buildKpiRow("Dépenses totales période", formatFcfa(exp), REPORT_COLORS.danger),
    buildKpiRow("Bénéfice net période", formatFcfa(net), net >= 0 ? REPORT_COLORS.success : REPORT_COLORS.danger),
    buildDivider(),
    buildSectionHeader("Top ventes marketplace", REPORT_COLORS.secondary),
    buildDataTable(
      ["Animal", "Poids", "Prix", "Date"],
      ctx.marketplace.topSales.slice(0, 3).map((s) => [
        s.animal,
        s.weightKg != null ? `${s.weightKg} kg` : "—",
        formatFcfa(s.price),
        new Date(s.date).toLocaleDateString("fr-FR")
      ])
    )
  ];

  const right: PdfContent[] = [
    buildSectionHeader("Répartition des revenus", REPORT_COLORS.accent),
    { svg: buildDonutSvg(revSegments, 120), width: 120, alignment: "center", margin: [0, 0, 0, 6] },
    ...revSegments.map((s) =>
      buildKpiRow(
        s.label,
        formatPct(rev > 0 ? (s.value / rev) * 100 : 0),
        REPORT_COLORS.greyText
      )
    ),
    buildDivider(),
    buildSectionHeader("Transactions en cours", REPORT_COLORS.secondary),
    buildKpiRow("Fonds bloqués (escrow)", formatFcfa(ctx.marketplace.pendingEscrowAmount)),
    buildKpiRow("Transactions en attente", String(ctx.marketplace.pendingEscrowCount)),
    { text: `${ctx.marketplace.pendingDeliveryCount} vente(s) en attente de livraison`, style: "small", margin: [0, 4, 0, 0] }
  ];

  return [buildTwoColumnLayout(55, left, right), buildPageFooter(ctx.reportRef, ctx.generatedAt)];
}

function pageCheptelHealth(ctx: FarmReportPdfContext): PdfContent[] {
  const h = health(ctx);
  const mort = Number(h.mortalityRate ?? 0) * 100;
  const healthyPct = Math.max(0, 100 - mort - 5);
  const healthDonut = [
    { label: "Sains", value: healthyPct, color: REPORT_COLORS.success },
    { label: "Traitement", value: Math.min(15, Number(h.diseaseActive ?? 0) * 3 + 5), color: REPORT_COLORS.secondary },
    { label: "Décès", value: mort, color: REPORT_COLORS.danger }
  ];

  const left: PdfContent[] = [
    buildSectionHeader("État du cheptel"),
    {
      columns: [
        buildInfographicBlock("Total têtes", String(ctx.cheptelCategories.total)),
        buildInfographicBlock("Truies", String(ctx.cheptelCategories.breedingFemales), REPORT_COLORS.primary)
      ],
      columnGap: 6
    },
    {
      columns: [
        buildInfographicBlock("Porcelets", String(ctx.cheptelCategories.piglets), REPORT_COLORS.secondary),
        buildInfographicBlock("Charcutiers", String(ctx.cheptelCategories.fattening), REPORT_COLORS.accent)
      ],
      columnGap: 6,
      margin: [0, 6, 0, 0]
    },
    {
      text: `Évolution cheptel vs période précédente : ${ctx.cheptelCategories.headcountDeltaPct != null ? formatPct(ctx.cheptelCategories.headcountDeltaPct) : "—"}`,
      style: "small",
      margin: [0, 8, 0, 8]
    },
    { svg: buildHorizontalBarSvg(Math.max(0, ctx.cheptelCategories.headcountDeltaPct ?? 50), 100, 260, 12), width: 260, margin: [0, 0, 0, 8] },
    buildDivider(),
    buildSectionHeader("Gestion de la gestation"),
    buildKpiRow("Gestations actives", String(ctx.gestationExtended.activeGestations)),
    buildKpiRow("Mises bas prévues ce mois", String(ctx.gestationExtended.expectedFarrowingsThisMonth)),
    buildKpiRow(
      "Taille moyenne portée",
      ctx.gestationExtended.avgLitterSize != null ? String(ctx.gestationExtended.avgLitterSize) : "—"
    ),
    ...ctx.gestationExtended.upcomingFarrowings.slice(0, 3).map((f) =>
      buildKpiRow(f.label, new Date(f.date).toLocaleDateString("fr-FR"))
    )
  ];

  const topDiseases = (h.topDiseases ?? []) as Array<{ label: string; count: number }>;
  const right: PdfContent[] = [
    buildSectionHeader("Suivi sanitaire"),
    { svg: buildDonutSvg(healthDonut, 110), width: 110, alignment: "center", margin: [0, 0, 0, 8] },
    buildKpiRow("Traitements actifs", String(h.diseaseActive ?? 0)),
    buildKpiRow("Interventions vétérinaires", String(h.vetVisits ?? 0)),
    buildKpiRow("Taux mortalité période", formatPct(mort)),
    buildKpiRow("Vaccinations réalisées", String(h.vaccinesDone ?? 0)),
    buildDivider(),
    buildSectionHeader("Événements sanitaires fréquents"),
    ...topDiseases.map((d, i) =>
      buildKpiRow(`${i + 1}. ${d.label}`, String(d.count))
    ),
    buildProgressBar(
      Number(h.vaccineCompletionPct ?? 0),
      100,
      REPORT_COLORS.success,
      "Couverture vaccinale du cheptel"
    )
  ];

  return [buildTwoColumnLayout(50, left, right), buildPageFooter(ctx.reportRef, ctx.generatedAt)];
}

function pageFeedPerformance(ctx: FarmReportPdfContext): PdfContent[] {
  const f = feed(ctx);
  const feedCost = Number(f.feedCost ?? 0);
  const consumption = (f.consumptionByType ?? []) as Array<{ name: string; consumedKg: string }>;
  const scoreCats = [
    { label: "Santé animale", score: ctx.scoreBreakdown.herdHealth.score },
    { label: "Gestion financière", score: ctx.scoreBreakdown.financialHealth.score },
    { label: "Alimentation", score: ctx.scoreBreakdown.dataRegularity.score },
    { label: "Reproduction", score: ctx.scoreBreakdown.productivity.score },
    { label: "Ventes", score: ctx.scoreBreakdown.financialHealth.score }
  ];

  const stockDays = ctx.feedExtended.stockDaysRemaining ?? 0;
  const stockColor =
    ctx.feedExtended.stockAlertLevel === "red"
      ? REPORT_COLORS.danger
      : ctx.feedExtended.stockAlertLevel === "amber"
        ? REPORT_COLORS.secondary
        : REPORT_COLORS.success;

  const left: PdfContent[] = [
    buildSectionHeader("Gestion de l'alimentation"),
    buildProgressBar(stockDays, 30, stockColor, "Stock vs consommation mensuelle"),
    buildKpiRow("Coût alimentation période", formatFcfa(feedCost)),
    buildKpiRow(
      "Coût par kg produit",
      ctx.feedExtended.costPerKgProduced != null ? formatFcfa(ctx.feedExtended.costPerKgProduced) : "—"
    ),
    buildDataTable(
      ["Type", "Consommé", "Coût"],
      consumption.slice(0, 4).map((c) => [c.name, `${c.consumedKg} kg`, "—"])
    ),
    {
      text:
        stockDays > 0
          ? `${stockDays} jour(s) de stock restants`
          : "Stock critique ou non renseigné",
      color: stockColor,
      bold: true,
      style: "small",
      margin: [0, 4, 0, 8]
    },
    buildDivider(),
    buildSectionHeader("Indicateurs de performance"),
    buildKpiRow("Ratio conversion alimentaire (FCR)", ctx.feedExtended.fcr != null ? String(ctx.feedExtended.fcr) : "—"),
    buildKpiRow("Gain quotidien moyen (ADG)", ctx.feedExtended.adg != null ? `${ctx.feedExtended.adg} g/j` : "—"),
    buildKpiRow("Coût par kg produit", ctx.feedExtended.costPerKgProduced != null ? formatFcfa(ctx.feedExtended.costPerKgProduced) : "—")
  ];

  const trendTxt =
    ctx.scoreTrendDelta != null
      ? `${ctx.scoreTrendDelta >= 0 ? "▲" : "▼"} ${Math.abs(ctx.scoreTrendDelta)} pts vs période préc.`
      : "—";

  const right: PdfContent[] = [
    buildSectionHeader("Score de la ferme"),
    { svg: buildGaugeSvg(ctx.scoreGlobal, 100, 140, REPORT_COLORS.primary), width: 140, alignment: "center", margin: [0, 0, 0, 8] },
    ...scoreCats.map((c) =>
      buildProgressBar(c.score, 100, REPORT_COLORS.primary, c.label)
    ),
    { text: trendTxt, style: "body", alignment: "center", margin: [0, 8, 0, 4] },
    {
      text: scoreInterpretation(ctx.scoreGlobal),
      bold: true,
      alignment: "center",
      color: REPORT_COLORS.primary,
      fontSize: REPORT_TYPO.h3
    }
  ];

  return [buildTwoColumnLayout(50, left, right), buildPageFooter(ctx.reportRef, ctx.generatedAt)];
}

function pageMarketplaceAi(ctx: FarmReportPdfContext): PdfContent[] {
  const mp = ctx.marketplace;
  const salesBar = mp.salesByCategory.map((c) => ({ label: c.label.slice(0, 8), value: c.count }));

  const left: PdfContent[] = [
    buildSectionHeader("Activité marketplace"),
    buildKpiRow("Ventes période", `${mp.salesCount} · ${formatFcfa(mp.totalFcfa)}`),
    buildKpiRow(
      "Prix moyen / kg",
      mp.avgPricePerKg != null
        ? `${formatFcfa(mp.avgPricePerKg).replace(" FCFA", "")} FCFA/kg${mp.pigPriceIndexDeltaPct != null ? ` (${mp.pigPriceIndexDeltaPct >= 0 ? "+" : ""}${formatPct(mp.pigPriceIndexDeltaPct)})` : ""}`
        : "—"
    ),
    { svg: buildBarChartSvg(salesBar, 280, 80, REPORT_COLORS.secondary), width: 280, margin: [0, 4, 0, 8] },
    buildKpiRow("Annonces non vendues", `${mp.unsoldListingsCount} · ${formatFcfa(mp.unsoldEstimatedValue)}`)
  ];

  const right: PdfContent[] = [
    buildSectionHeader("Recommandations IA"),
    ...ctx.recommendations.slice(0, 5).map((r) => buildRecommendationCard(r)),
    buildDivider(),
    buildSectionHeader("Objectifs période suivante"),
    ...ctx.objectives.slice(0, 3).map((o, i) => ({
      text: `${i + 1}. ${o}`,
      style: "small",
      margin: [0, 2, 0, 2]
    }))
  ];

  return [buildTwoColumnLayout(55, left, right), buildPageFooter(ctx.reportRef, ctx.generatedAt)];
}

function pageBankScoring(ctx: FarmReportPdfContext): PdfContent[] {
  const finSec = fin(ctx);
  const cur = (finSec.current as { totals?: { revenues: string; expenses: string } })?.totals;
  const rev = Number(cur?.revenues ?? 0);
  const exp = Number(cur?.expenses ?? 0);
  const net = rev - exp;
  const bs = ctx.bankScoring;
  const riskColor =
    bs.riskLevel === "FAIBLE"
      ? REPORT_COLORS.success
      : bs.riskLevel === "MODÉRÉ"
        ? REPORT_COLORS.secondary
        : REPORT_COLORS.danger;

  const rows: [string, string][] = [
    ["Nom exploitant", ctx.ownerName],
    ["Nom ferme", ctx.farmName],
    ["Localisation", ctx.address?.trim() || "—"],
    ["Années d'activité", `${Math.max(1, Math.round((ctx.sections.meta as { farmAgeMonths?: number })?.farmAgeMonths ?? 12) / 12)} an(s)`],
    ["Effectif cheptel", `${ctx.cheptelCategories.total} têtes`],
    ["Revenu moyen mensuel", formatFcfa(bs.avgMonthlyRevenue)],
    ["Revenu période", formatFcfa(rev)],
    ["Dépenses période", formatFcfa(exp)],
    ["Bénéfice net", formatFcfa(net)],
    ["Croissance cheptel", bs.herdGrowthPct != null ? formatPct(bs.herdGrowthPct) : "—"],
    ["Score FermierPro", `${ctx.scoreGlobal} / 100`],
    ["Niveau de risque estimé", bs.riskLevel]
  ];

  return [
    buildSectionHeader("Synthèse bancaire et évaluation de crédit", REPORT_COLORS.accent),
    {
      text: "Document généré automatiquement par FermierPro — Données certifiées par la plateforme",
      style: "small",
      color: REPORT_COLORS.greyText,
      margin: [0, 0, 0, 12]
    },
    buildDataTable(
      ["Indicateur", "Valeur"],
      rows.map(([a, b]) => [a, b])
    ),
    { text: "Évaluation des risques", style: "h2", margin: [0, 12, 0, 8] },
    {
      table: {
        widths: ["*", "auto"],
        body: [
          [
            { text: "Score global de risque", style: "body" },
            { text: bs.riskLevel, bold: true, color: riskColor, fontSize: 16, alignment: "right" }
          ]
        ]
      },
      layout: "noBorders",
      margin: [0, 0, 0, 8]
    },
    buildKpiRow("Risque sanitaire", `${bs.risqueSanitaire} / 100`),
    buildKpiRow("Risque financier", `${bs.risqueFinancier} / 100`),
    buildKpiRow("Risque opérationnel", `${bs.risqueOperationnel} / 100`),
    buildDivider(),
    {
      columns: [
        {
          width: "*",
          stack: [
            {
              text: "Ces données sont issues de la plateforme FermierPro et reflètent l'activité réelle enregistrée par le producteur.",
              style: "small",
              italics: true
            },
            { text: `FermierPro · ${ctx.reportRef}`, style: "small", margin: [0, 8, 0, 0] },
            { text: `Empreinte SHA-256 : ${ctx.contentHash?.slice(0, 16) ?? "—"}…`, style: "small", color: REPORT_COLORS.greyText }
          ]
        },
        ctx.qrCodeDataUrl
          ? { image: ctx.qrCodeDataUrl, width: 72, alignment: "right" }
          : { text: "", width: 72 }
      ],
      margin: [0, 8, 0, 0]
    },
    buildPageFooter(ctx.reportRef, ctx.generatedAt)
  ];
}

export function buildFarmReportDocDefinition(
  ctx: FarmReportPdfContext
): PdfDocumentDefinitions {
  return {
    pageSize: "A4",
    pageMargins: [
      REPORT_MARGINS.left,
      REPORT_MARGINS.top,
      REPORT_MARGINS.right,
      REPORT_MARGINS.bottom
    ],
    defaultStyle: {
      font: "Roboto",
      fontSize: REPORT_TYPO.body,
      color: REPORT_COLORS.accent
    },
    styles: {
      sectionHeader: { fontSize: REPORT_TYPO.h2, bold: true, color: REPORT_COLORS.accent },
      h2: { fontSize: REPORT_TYPO.h2, bold: true },
      h3: { fontSize: REPORT_TYPO.h3, bold: true },
      body: { fontSize: REPORT_TYPO.body },
      small: { fontSize: REPORT_TYPO.small, color: REPORT_COLORS.greyText },
      kpiLabel: { fontSize: REPORT_TYPO.small, color: REPORT_COLORS.greyText },
      kpiValue: { fontSize: REPORT_TYPO.h2, bold: true },
      badge: { fontSize: REPORT_TYPO.small, bold: true },
      footer: { fontSize: REPORT_TYPO.small, color: REPORT_COLORS.greyText }
    },
    content: [
      ...pageCover(ctx),
      { text: "", pageBreak: "after" },
      ...pageFinance(ctx),
      { text: "", pageBreak: "after" },
      ...pageCheptelHealth(ctx),
      { text: "", pageBreak: "after" },
      ...pageFeedPerformance(ctx),
      { text: "", pageBreak: "after" },
      ...pageMarketplaceAi(ctx),
      { text: "", pageBreak: "after" },
      ...pageBankScoring(ctx)
    ],
    info: {
      title: `Rapport ${ctx.farmName}`,
      author: "FermierPro",
      subject: ctx.reportRef
    }
  };
}
