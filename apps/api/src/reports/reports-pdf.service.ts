import { Injectable } from "@nestjs/common";
import type { FarmReport } from "@prisma/client";
import PDFDocument from "pdfkit";

const APP_NAME = "Fermier Pro";

type PdfDoc = InstanceType<typeof PDFDocument>;

type StoredSnapshot = {
  period?: { start: string; end: string };
  score?: {
    global: number;
    band: string;
    breakdown: Record<string, { score: number; detail: string }>;
  };
  sections?: Record<string, unknown>;
};

@Injectable()
export class ReportsPdfService {
  renderFarmReportPdf(input: {
    farmName: string;
    ownerName: string;
    address: string | null;
    report: FarmReport;
  }): Promise<Buffer> {
    const snap = input.report.dataSnapshot as unknown as StoredSnapshot;
    const sections = snap.sections ?? {};
    const fin = (sections.finance ?? {}) as Record<string, unknown>;
    const cheptel = (sections.cheptel ?? {}) as Record<string, unknown>;
    const health = (sections.health ?? {}) as Record<string, unknown>;
    const feed = (sections.feed ?? {}) as Record<string, unknown>;
    const gestation = (sections.gestation ?? {}) as Record<string, unknown>;
    const projection = (sections.projection ?? {}) as Record<string, unknown>;
    const alerts = (sections.smartAlertsTop ?? []) as Array<{
      title: string;
      message: string;
      priority: string;
    }>;

    const scoreGlobal = input.report.scoreGlobal;
    const band = snap.score?.band ?? "—";
    const periodLabel = `${input.report.periodStart.toISOString().slice(0, 10)} → ${input.report.periodEnd.toISOString().slice(0, 10)}`;
    const genAt = input.report.generatedAt.toISOString();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 48,
        size: "A4",
        bufferPages: true,
        info: {
          Title: `Rapport ${input.farmName}`,
          Author: APP_NAME
        }
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => {
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          this.drawHeaderFooter(
            doc,
            input.farmName,
            i - range.start + 1,
            range.count
          );
        }
        doc.flushPages();
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", reject);

      this.pageCover(doc, {
        farmName: input.farmName,
        ownerName: input.ownerName,
        address: input.address,
        periodLabel,
        genAt,
        scoreGlobal,
        band
      });

      this.pageSection(doc, "Synthèse financière", () => {
        const cur = (fin.current as { totals?: Record<string, string> })?.totals;
        const prev = (fin.previous as { totals?: Record<string, string> })?.totals;
        doc.fontSize(10);
        if (cur) {
          doc.text(`Revenus: ${cur.revenues ?? "0"}`);
          doc.text(`Dépenses: ${cur.expenses ?? "0"}`);
          const revN = Number(cur.revenues ?? 0);
          const expN = Number(cur.expenses ?? 0);
          doc.text(`Marge nette: ${(revN - expN).toFixed(0)}`);
          doc.text(
            `Marge %: ${revN > 0 ? (((revN - expN) / revN) * 100).toFixed(1) : "—"}%`
          );
        }
        if (prev) {
          doc.moveDown(0.5);
          doc.text(`Période précédente — revenus: ${prev.revenues}, dépenses: ${prev.expenses}`);
        }
        const dRev = fin.deltaRevenuesPct;
        const dExp = fin.deltaExpensesPct;
        if (dRev != null) doc.text(`Δ revenus vs période préc.: ${String(dRev)}%`);
        if (dExp != null) doc.text(`Δ dépenses vs période préc.: ${String(dExp)}%`);
        const trend = (fin.monthlyTrend ?? []) as Array<{
          month: string;
          revenues: string;
          expenses: string;
        }>;
        if (trend.length) {
          doc.moveDown();
          doc.fontSize(11).text("Évolution mensuelle (revenus / dépenses)", {
            underline: true
          });
          doc.fontSize(8);
          this.drawDualLineChart(doc, trend, 60, doc.y + 8, 480, 120);
          doc.moveDown(10);
          doc.fontSize(9);
          for (const row of trend.slice(-12)) {
            doc.text(`${row.month}  rev ${row.revenues}  dep ${row.expenses}`);
          }
        }
        const topExp = (fin.topExpenses ?? []) as Array<{ label: string; expenses: number }>;
        const topRev = (fin.topRevenues ?? []) as Array<{ label: string; revenues: number }>;
        if (topExp.length) {
          doc.moveDown();
          doc.fontSize(11).text("Top 3 dépenses", { underline: true });
          doc.fontSize(9);
          for (const r of topExp) {
            doc.text(`${r.label}: ${r.expenses}`);
          }
        }
        if (topRev.length) {
          doc.moveDown();
          doc.fontSize(11).text("Top 3 revenus", { underline: true });
          doc.fontSize(9);
          for (const r of topRev) {
            doc.text(`${r.label}: ${r.revenues}`);
          }
        }
      });
      doc.addPage();

      this.pageSection(doc, "Synthèse cheptel", () => {
        doc.fontSize(10);
        doc.text(`Effectif fin période: ${String(cheptel.headcountEnd ?? "—")}`);
        doc.text(`Naissances / entrées: ${String(cheptel.births ?? "—")}`);
        doc.text(`Ventes: ${String(cheptel.salesExits ?? "—")}`);
        doc.text(`Morts: ${String(cheptel.deaths ?? "—")}`);
        doc.text(`Réformes / abattage: ${String(cheptel.reformsExits ?? "0")}`);
        doc.text(`Bandes actives: ${String(cheptel.batchesActive ?? "—")}`);
        doc.text(`Bandes clôturées: ${String(cheptel.batchesClosed ?? "—")}`);
        const bySp = cheptel.animalsBySpecies as
          | Array<{ name: string; count: number }>
          | undefined;
        if (bySp?.length) {
          doc.moveDown();
          doc.fontSize(11).text("Répartition par espèce", { underline: true });
          doc.fontSize(9);
          for (const r of bySp) {
            doc.text(`${r.name}: ${r.count}`);
          }
        }
      });
      doc.addPage();

      this.pageSection(doc, "Synthèse santé", () => {
        doc.fontSize(10);
        doc.text(`Taux mortalité (indic.): ${((Number(health.mortalityRate ?? 0) || 0) * 100).toFixed(2)}%`);
        doc.text(`Cas maladies (période): ${String(health.diseaseCases ?? "—")}`);
        doc.text(`Maladies actives / résolues: ${String(health.diseaseActive ?? "—")} / ${String(health.diseaseResolved ?? "—")}`);
        doc.text(`Vaccinations réalisées: ${String(health.vaccinesDone ?? "—")}`);
        doc.text(`Vaccinations planifiées (rappels): ${String(health.vaccinesPlanned ?? "—")}`);
        doc.text(
          `Taux vaccins réalisés / planifiés: ${health.vaccineCompletionPct != null ? `${health.vaccineCompletionPct}%` : "—"}`
        );
        doc.text(`Visites vétérinaires: ${String(health.vetVisits ?? "—")}`);
        doc.text(`Coût santé (estim.): ${String(health.healthSpend ?? "0")}`);
        doc.text(`Statut sanitaire: ${String(health.healthStatus ?? "—")}`);
        const topD = (health.topDiseases ?? []) as Array<{ label: string; count: number }>;
        if (topD.length) {
          doc.moveDown();
          doc.fontSize(11).text("Maladies les plus fréquentes", { underline: true });
          doc.fontSize(9);
          for (const r of topD) {
            doc.text(`${r.label}: ${r.count}`);
          }
        }
      });
      doc.addPage();

      this.pageSection(doc, "Stock aliment", () => {
        doc.fontSize(10);
        doc.text(`Entrées stock (kg, période): ${String(feed.feedInKg ?? "0")}`);
        doc.text(`Coût alimentation: ${String(feed.feedCost ?? "0")}`);
        doc.text(`Coût / tête / jour: ${Number(feed.costPerHeadDay ?? 0).toFixed(4)}`);
        doc.text(`Contrôles stock: ${String(feed.stockChecks ?? "0")}`);
        doc.text(`Types en rupture / critique: ${String(feed.stockBreakTypes ?? "0")}`);
        doc.text(
          `Ratio aliment / revenus: ${feed.ratioFeedRevenuesPct != null ? `${Number(feed.ratioFeedRevenuesPct).toFixed(1)}%` : "—"}`
        );
        const byT = feed.consumptionByType as
          | Array<{ name: string; consumedKg: string }>
          | undefined;
        if (byT?.length) {
          doc.moveDown();
          doc.fontSize(11).text("Consommation estimée par type", { underline: true });
          doc.fontSize(9);
          for (const r of byT) {
            doc.text(`${r.name}: ${r.consumedKg} kg`);
          }
        }
      });
      doc.addPage();

      this.pageSection(doc, "Gestation & reproduction", () => {
        doc.fontSize(10);
        doc.text(`Mises bas (naissances enreg.): ${String(gestation.farrowingsCount ?? "—")}`);
        doc.text(`Taux réussite gestation (estim.): ${gestation.gestationSuccessPct != null ? `${gestation.gestationSuccessPct}%` : "—"}`);
        doc.text(`Moyenne porcelets / portée: ${gestation.avgPigletsPerFarrowing != null ? String(gestation.avgPigletsPerFarrowing) : "—"}`);
        doc.text(`Mortalité néonatale (estim.): ${gestation.neonatalMortalityPct != null ? `${gestation.neonatalMortalityPct}%` : "—"}`);
        doc.text(`Reproducteurs actifs (suivi): ${String(gestation.activeBreeders ?? "—")}`);
        doc.text(`Intervalle mise bas moyen (j): ${gestation.avgDaysBetweenFarrowing != null ? String(gestation.avgDaysBetweenFarrowing) : "—"}`);
      });
      doc.addPage();

      this.pageSection(doc, "Projections & alertes", () => {
        const nm = (projection.nextMonths ?? []) as Array<{
          monthOffset: number;
          projectedRevenues: string;
          projectedExpenses: string;
          projectedNet: string;
        }>;
        doc.fontSize(10);
        if (nm.length) {
          doc.text("Projection revenus / dépenses (M+1 à M+3, moyenne glissante)");
          doc.fontSize(9);
          for (const m of nm) {
            doc.text(
              `M+${m.monthOffset} — rev. ${m.projectedRevenues} / dép. ${m.projectedExpenses} (net ${m.projectedNet})`
            );
          }
        } else {
          doc.text("Projections: données insuffisantes.");
        }
        doc.moveDown();
        doc.fontSize(11).text("SmartAlerts — priorités", { underline: true });
        doc.fontSize(9);
        if (!alerts.length) {
          doc.text("Aucune alerte prioritaire.");
        } else {
          for (const a of alerts) {
            doc.text(`• [${a.priority}] ${a.title}: ${a.message}`);
          }
        }
      });

      doc.addPage();
      this.pageLegal(doc, {
        contentHash: input.report.contentHash ?? "",
        genAt
      });

      doc.end();
    });
  }

  private drawHeaderFooter(
    doc: PdfDoc,
    farmName: string,
    page: number,
    total: number
  ) {
    const w = doc.page.width;
    const m = 36;
    doc.save();
    doc.fontSize(8).fillColor("#555555");
    doc.text(`${APP_NAME} — ${farmName}`, m, 28, {
      width: w - 2 * m,
      continued: false
    });
    doc.text(`Page ${page} / ${total}`, m, 28, {
      width: w - 2 * m,
      align: "right"
    });
    doc
      .moveTo(m, 42)
      .lineTo(w - m, 42)
      .strokeColor("#cccccc")
      .lineWidth(0.5)
      .stroke();
    const yFoot = doc.page.height - 36;
    doc.fontSize(7).fillColor("#888888");
    doc.text("Document confidentiel — usage bancaire possible sous réserve de pièces justificatives.", m, yFoot, {
      width: w - 2 * m,
      align: "center"
    });
    doc.restore();
  }

  private pageCover(
    doc: PdfDoc,
    p: {
      farmName: string;
      ownerName: string;
      address: string | null;
      periodLabel: string;
      genAt: string;
      scoreGlobal: number;
      band: string;
    }
  ) {
    doc.fontSize(22).fillColor("#111111").text("Rapport de ferme", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(p.farmName, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor("#333333").text(`Producteur : ${p.ownerName}`, {
      align: "center"
    });
    if (p.address) {
      doc.text(`Localisation : ${p.address}`, { align: "center" });
    }
    doc.moveDown();
    doc.fontSize(10).text(`Période couverte : ${p.periodLabel}`, { align: "center" });
    doc.text(`Date de génération : ${p.genAt.slice(0, 19)}Z`, { align: "center" });
    doc.moveDown(2);
    doc.fontSize(12).text(`Score Ferme : ${p.scoreGlobal} / 100`, { align: "center" });
    doc.fontSize(11).text(`Mention : ${p.band}`, { align: "center" });
    doc.moveDown(1.5);
    this.drawScoreGauge(doc, p.scoreGlobal, doc.page.width / 2, 320, 72);
    doc.moveDown(8);
    doc
      .fontSize(9)
      .fillColor("#444444")
      .text(
        "Ce score est calculé automatiquement à partir des données saisies dans l’application et peut être présenté à votre établissement bancaire à titre indicatif.",
        60,
        doc.y,
        { width: doc.page.width - 120, align: "center" }
      );
    doc.addPage();
  }

  private pageSection(
    doc: PdfDoc,
    title: string,
    body: () => void
  ) {
    doc.fontSize(16).fillColor("#111111").text(title, { underline: true });
    doc.moveDown(0.75);
    doc.fillColor("#222222");
    body();
  }

  private pageLegal(
    doc: PdfDoc,
    p: { contentHash: string; genAt: string }
  ) {
    doc.fontSize(14).text("Mentions légales", { underline: true });
    doc.moveDown();
    doc.fontSize(10).fillColor("#222222");
    doc.text(`Rapport généré par ${APP_NAME}.`);
    doc.text("Données issues du suivi quotidien enregistré dans l’application.");
    doc.moveDown();
    doc.text(`Empreinte SHA-256 du snapshot : ${p.contentHash || "—"}`);
    doc.text(`Horodatage : ${p.genAt}`);
  }

  private drawScoreGauge(doc: PdfDoc, score: number, cx: number, cy: number, r: number) {
    const clamped = Math.max(0, Math.min(100, score));
    const start = Math.PI;
    const sweep = Math.PI * (clamped / 100);
    doc.save();
    doc.lineWidth(10);
    doc.strokeColor("#e0e0e0");
    doc
      .path(`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`)
      .stroke();
    let color = "#c0392b";
    if (clamped >= 85) color = "#27ae60";
    else if (clamped >= 65) color = "#2980b9";
    else if (clamped >= 45) color = "#f39c12";
    doc.strokeColor(color);
    const ex = cx + r * Math.cos(start + sweep);
    const ey = cy + r * Math.sin(start + sweep);
    doc
      .path(`M ${cx - r} ${cy} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${ex} ${ey}`)
      .stroke();
    doc.fillColor("#111111").fontSize(16).text(String(clamped), cx - 18, cy - 10, {
      lineBreak: false
    });
    doc.restore();
  }

  private drawDualLineChart(
    doc: PdfDoc,
    rows: Array<{ month: string; revenues: string; expenses: string }>,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    const slice = rows.slice(-12);
    if (!slice.length) return;
    const revs = slice.map((r) => Number(r.revenues) || 0);
    const exps = slice.map((r) => Number(r.expenses) || 0);
    const max = Math.max(1, ...revs, ...exps);
    const n = slice.length;
    const step = w / Math.max(1, n - 1);
    doc.save();
    doc.rect(x, y, w, h).strokeColor("#bbbbbb").lineWidth(0.5).stroke();
    const line = (vals: number[], color: string) => {
      doc.strokeColor(color).lineWidth(1.5);
      for (let i = 0; i < n; i++) {
        const px = x + i * step;
        const py = y + h - (vals[i]! / max) * (h - 8) - 4;
        if (i === 0) doc.moveTo(px, py);
        else doc.lineTo(px, py);
      }
      doc.stroke();
    };
    line(revs, "#2d6a4f");
    line(exps, "#c0392b");
    doc.fillColor("#333333").fontSize(7);
    slice.forEach((r, i) => {
      const px = x + i * step;
      doc.text(r.month.slice(5), px - 8, y + h + 2, { width: 36, align: "center" });
    });
    doc.restore();
    doc.y = y + h + 16;
  }
}
