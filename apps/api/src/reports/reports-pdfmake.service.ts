import { Injectable, Logger } from "@nestjs/common";
import type { FarmReport } from "@prisma/client";
import QRCode from "qrcode";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require("pdfmake/build/pdfmake");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfFonts = require("pdfmake/build/vfs_fonts");

PdfPrinter.vfs = pdfFonts.pdfMake?.vfs ?? pdfFonts.vfs;

const fonts = {
  Roboto: {
    normal: Buffer.from(PdfPrinter.vfs["Roboto-Regular.ttf"], "base64"),
    bold: Buffer.from(PdfPrinter.vfs["Roboto-Medium.ttf"], "base64"),
    italics: Buffer.from(PdfPrinter.vfs["Roboto-Italic.ttf"], "base64"),
    bolditalics: Buffer.from(PdfPrinter.vfs["Roboto-MediumItalic.ttf"], "base64")
  }
};

const printer = new PdfPrinter(fonts);

import { buildFarmReportDocDefinition } from "./templates/farm-report.template";
import type {
  FarmReportPdfContext,
  StoredReportSnapshot
} from "./templates/farm-report.types";
import type { ScoreBreakdown } from "./reports-score.util";
import { riskLevelLabel } from "./templates/formatters";

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

    const breakdown = (snap.score?.breakdown ??
      input.report.scoreBreakdown) as ScoreBreakdown;
    const scoreGlobal = snap.score?.global ?? input.report.scoreGlobal;

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
      qrCodeDataUrl
    };

    const docDefinition = buildFarmReportDocDefinition(ctx);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", reject);
      pdfDoc.end();
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
