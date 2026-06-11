import { Injectable, Logger } from "@nestjs/common";
import type { FarmReport } from "@prisma/client";
import QRCode from "qrcode";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfMake = require("pdfmake/build/pdfmake");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfFonts = require("pdfmake/build/vfs_fonts");

type PdfFontVfs = Record<string, string>;

function resolvePdfmakeVfs(raw: Record<string, unknown>): PdfFontVfs {
  const nested =
    (raw.pdfMake as { vfs?: PdfFontVfs } | undefined)?.vfs ??
    (raw.vfs as PdfFontVfs | undefined);
  if (nested) return nested;
  if (typeof raw["Roboto-Regular.ttf"] === "string") {
    return raw as PdfFontVfs;
  }
  throw new Error("pdfmake vfs fonts could not be loaded");
}

pdfMake.addVirtualFileSystem(resolvePdfmakeVfs(pdfFonts));
pdfMake.addFonts({
  Roboto: {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf"
  }
});

import { buildFarmReportDocDefinition } from "./templates/farm-report.template";
import type {
  FarmReportPdfContext,
  StoredReportSnapshot
} from "./templates/farm-report.types";
import type { ScoreBreakdown } from "./reports-score.util";
import { riskLevelLabel } from "./templates/formatters";

function normalizeScoreBreakdown(
  raw: Partial<ScoreBreakdown> | null | undefined,
  scoreGlobal: number
): ScoreBreakdown {
  if (
    raw?.dataRegularity?.score != null &&
    raw?.financialHealth?.score != null &&
    raw?.herdHealth?.score != null &&
    raw?.productivity?.score != null &&
    raw?.historyCompleteness?.score != null
  ) {
    return raw as ScoreBreakdown;
  }
  const g = Math.max(0, Math.min(100, scoreGlobal));
  const slot = (detail: string) => ({ score: g, detail });
  return {
    dataRegularity: raw?.dataRegularity ?? slot("Densité de saisie sur la période."),
    financialHealth: raw?.financialHealth ?? slot("Marge nette relative sur la période."),
    herdHealth: raw?.herdHealth ?? slot("Mortalité et vaccins en retard."),
    productivity: raw?.productivity ?? slot("Mises bas enregistrées sur la période."),
    historyCompleteness:
      raw?.historyCompleteness ?? slot("Ancienneté de la ferme et continuité des données.")
  };
}

const VERIFY_BASE =
  process.env.REPORT_VERIFY_BASE_URL?.trim() ??
  "https://fermierpro.com/verify/report";

@Injectable()
export class ReportsPdfmakeService {
  private readonly log = new Logger(ReportsPdfmakeService.name);

  buildReportRef(reportId: string, periodStart: Date): string {
    const y = periodStart.getUTCFullYear();
    const m = String(periodStart.getUTCMonth() + 1).padStart(2, "0");
    return `RPT-${y}${m}-${reportId.slice(-8).toUpperCase()}`;
  }

  async renderFarmReportPdf(input: {
    farmName: string;
    ownerName: string;
    address: string | null;
    report: FarmReport;
  }): Promise<Buffer> {
    const snap = input.report.dataSnapshot as unknown as StoredReportSnapshot;
    const sections = snap.sections ?? {};
    const fin = (sections.finance ?? {}) as {
      current?: { currency?: string; totals?: { revenues: string } };
    };

    const verifyUrl = `${VERIFY_BASE}/${input.report.id}?hash=${input.report.contentHash ?? ""}`;
    let qrCodeDataUrl: string | null = null;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, { width: 160, margin: 1 });
    } catch (e) {
      this.log.warn(`QR code generation failed: ${String(e)}`);
    }

    const scoreGlobal = snap.score?.global ?? input.report.scoreGlobal;
    const breakdown = normalizeScoreBreakdown(
      (snap.score?.breakdown ?? input.report.scoreBreakdown) as
        | Partial<ScoreBreakdown>
        | null
        | undefined,
      scoreGlobal
    );

    const ctx: FarmReportPdfContext = {
      farmName: input.farmName,
      ownerName: input.ownerName,
      address: input.address,
      reportId: input.report.id,
      reportRef: this.buildReportRef(input.report.id, input.report.periodStart),
      periodType: input.report.periodType,
      periodStart: input.report.periodStart.toISOString(),
      periodEnd: input.report.periodEnd.toISOString(),
      generatedAt: input.report.generatedAt.toISOString(),
      contentHash: input.report.contentHash,
      scoreGlobal,
      scoreBand: snap.score?.band ?? "—",
      scoreBreakdown: breakdown,
      scoreTrendDelta: null,
      currency: fin.current?.currency ?? "XOF",
      sections,
      marketplace: snap.marketplace ?? this.defaultMarketplace(),
      recommendations: snap.recommendations ?? [],
      objectives: snap.objectives ?? [],
      bankScoring:
        snap.bankScoring ??
        this.defaultBankScoring(scoreGlobal, breakdown, fin),
      cheptelCategories: snap.cheptelCategories ?? {
        total: Number((sections.cheptel as { headcountEnd?: number })?.headcountEnd ?? 0),
        breedingFemales: 0,
        piglets: 0,
        fattening: 0,
        breedingMales: 0,
        headcountDeltaPct: null
      },
      gestationExtended: snap.gestationExtended ?? {
        activeGestations: Number((sections.gestation as { activeBreeders?: number })?.activeBreeders ?? 0),
        expectedFarrowingsThisMonth: 0,
        avgLitterSize: null,
        upcomingFarrowings: []
      },
      feedExtended: snap.feedExtended ?? {
        stockDaysRemaining: null,
        stockAlertLevel: "amber",
        costPerKgProduced: null,
        fcr: null,
        adg: null
      },
      profitability: snap.profitability ?? this.defaultProfitability(),
      predictions: snap.predictions ?? this.defaultPredictions(),
      qrCodeDataUrl
    };

    const docDefinition = buildFarmReportDocDefinition(ctx);
    const pdfDoc = pdfMake.createPdf(docDefinition);

    return new Promise((resolve, reject) => {
      pdfDoc.getBuffer((buffer: Buffer) => resolve(buffer), reject);
    });
  }

  private defaultMarketplace() {
    return {
      salesCount: 0,
      totalFcfa: 0,
      avgPricePerKg: null,
      pigPriceIndexDeltaPct: null,
      salesByCategory: [],
      topSales: [],
      unsoldListingsCount: 0,
      unsoldEstimatedValue: 0,
      pendingEscrowCount: 0,
      pendingEscrowAmount: 0,
      pendingDeliveryCount: 0
    };
  }

  private defaultProfitability() {
    return {
      available: false,
      dataQuality: "insufficient",
      currency: "XOF",
      marketPricePerKg: null,
      realized: {
        grossMargin: null,
        grossMarginPct: null,
        netMargin: null,
        netMarginPct: null,
        costPerKg: null,
        roi: null,
        breakevenPricePerKg: null,
        revenues: null,
        costsTotal: null
      },
      trendNetMarginPctDelta: null,
      trendGrossMarginPctDelta: null,
      costBreakdown: [],
      monthlySeries: [],
      topBatches: []
    };
  }

  private defaultPredictions() {
    return {
      available: false,
      generatedAt: null,
      insufficientData: false,
      insufficientMessage: null,
      financeForecast: {
        horizon30: null,
        horizon60: null,
        horizon90: null,
        cashFlowAlert: { hasAlert: false, message: null }
      },
      saleTiming: null,
      alerts: [],
      herdEvolution: null,
      animalsReady30: null,
      upcomingBirths: []
    };
  }

  private defaultBankScoring(
    scoreGlobal: number,
    breakdown: ScoreBreakdown,
    fin: { current?: { totals?: { revenues?: string; expenses?: string } } }
  ) {
    const rev = Number(fin.current?.totals?.revenues ?? 0);
    const exp = Number(fin.current?.totals?.expenses ?? 0);
    return {
      riskLevel: riskLevelLabel(scoreGlobal),
      risqueSanitaire: breakdown.herdHealth.score,
      risqueFinancier: breakdown.financialHealth.score,
      risqueOperationnel: Math.round(
        (breakdown.productivity.score + breakdown.dataRegularity.score) / 2
      ),
      avgMonthlyRevenue: rev / 3,
      herdGrowthPct: null
    };
  }
}
