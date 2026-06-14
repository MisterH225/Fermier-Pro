import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { ReceiptPdfInput } from "./receipt.format";
import {
  formatReceiptDateOnly,
  formatReceiptMoney,
  shortTransactionId
} from "./receipt.format";

type PdfDoc = InstanceType<typeof PDFDocument>;

const BRAND_GREEN = "#2D6A4F";
const BRAND_LIGHT = "#E8F5E9";
const TEXT_DARK = "#1A1A1A";
const TEXT_MUTED = "#6B7280";
const ROW_ALT = "#F8F9FA";
const MARGIN = 32;

@Injectable()
export class ReceiptPdfService {
  async renderReceiptPdf(input: ReceiptPdfInput): Promise<Buffer> {
    const qrPng = await QRCode.toBuffer(input.verifyUrl, {
      type: "png",
      margin: 1,
      width: 80
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: MARGIN,
        size: "A4",
        info: { Title: `Reçu ${input.receiptNumber}`, Author: "FermierPro" }
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const W = doc.page.width - MARGIN * 2;
      const L = MARGIN;

      // ── Header compact ────────────────────────────────────────────────
      doc.rect(L, MARGIN, W, 46).fill(BRAND_GREEN);
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(16);
      doc.text("FermierPro", L + 12, MARGIN + 8, { continued: true });
      doc.font("Helvetica").fontSize(10);
      doc.text(`  ·  REÇU DE TRANSACTION N° ${input.receiptNumber}`, {
        continued: false
      });
      doc.fontSize(8).fillColor("rgba(255,255,255,0.8)");
      doc.text(
        `Transaction ${shortTransactionId(input.transactionId)}  ·  Émis le ${new Date(input.issuedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
        L + 12,
        MARGIN + 30
      );

      doc.y = MARGIN + 56;

      // ── Vendeur / Acheteur ────────────────────────────────────────────
      const half = (W - 12) / 2;
      this.drawPartyBox(doc, L, doc.y, half, "Vendeur", input.seller);
      this.drawPartyBox(doc, L + half + 12, doc.y, half, "Acheteur", {
        fullName: input.buyer.fullName,
        phone: input.buyer.phone,
        farmName: null,
        farmLocation: null
      });
      doc.y += 62;

      this.drawHR(doc, L, W);

      // ── Corps principal en 2 colonnes ─────────────────────────────────
      const leftW = W * 0.44;
      const rightW = W - leftW - 12;
      const bodyY = doc.y;

      // Colonne gauche : animal + chronologie
      let ly = bodyY;
      ly = this.drawSection(doc, L, ly, leftW, "Animal");
      const fin = input.financial;
      const animalRows: [string, string][] = [
        ["Identifiant", input.animal.label],
        ["Catégorie", input.animal.categoryLabel]
      ];
      if (input.animal.estimatedWeightKg != null) {
        animalRows.push(["Poids estimé", `${input.animal.estimatedWeightKg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`]);
      }
      if (input.animal.realWeightKg != null) {
        animalRows.push(["Poids réel", `${input.animal.realWeightKg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`]);
      }
      if (input.animal.weightDeltaPct != null) {
        animalRows.push(["Écart", `${input.animal.weightDeltaPct >= 0 ? "+" : ""}${input.animal.weightDeltaPct.toFixed(1)} %`]);
      }
      ly = this.drawCompactTable(doc, L, ly, leftW, animalRows);

      ly += 6;
      ly = this.drawSection(doc, L, ly, leftW, "Chronologie");
      const tl = input.timeline;
      const tlRows: [string, string][] = [
        ["Offre acceptée", formatReceiptDateOnly(tl.offerAcceptedAt)],
        ["Paiement sécurisé", formatReceiptDateOnly(tl.paymentConfirmedAt)],
        ["Livraison", formatReceiptDateOnly(tl.pickupDate)],
        ["Poids confirmé", formatReceiptDateOnly(tl.weightValidatedAt)],
        ["Transaction clôturée", formatReceiptDateOnly(tl.closedAt)]
      ];
      ly = this.drawCompactTable(doc, L, ly, leftW, tlRows);

      // Colonne droite : financier
      let ry = bodyY;
      ry = this.drawSection(doc, L + leftW + 12, ry, rightW, "Récapitulatif financier");

      const finRows: [string, string][] = [
        ["Prix convenu", fin.priceLabel],
        ["Montant transaction", formatReceiptMoney(fin.grossAmount, fin.currency)]
      ];
      // Frais acheteur
      if (fin.buyerCommissionRatePct > 0) {
        finRows.push([
          `Frais acheteur (${fin.buyerCommissionRatePct.toFixed(1)} %)`,
          `+ ${formatReceiptMoney(fin.buyerCommissionAmount, fin.currency)}`
        ]);
      }
      finRows.push([
        "Total payé par l'acheteur",
        formatReceiptMoney(fin.buyerPaidAmount, fin.currency)
      ]);
      if (fin.buyerRefundAmount > 0) {
        finRows.push(["Remboursement acheteur", `- ${formatReceiptMoney(fin.buyerRefundAmount, fin.currency)}`]);
      }
      if (fin.buyerAdditionalCharge > 0) {
        finRows.push(["Complément acheteur", `+ ${formatReceiptMoney(fin.buyerAdditionalCharge, fin.currency)}`]);
      }
      // Frais vendeur
      if (fin.sellerCommissionRatePct > 0) {
        finRows.push([
          `Frais vendeur (${fin.sellerCommissionRatePct.toFixed(1)} %)`,
          `- ${formatReceiptMoney(fin.sellerCommissionAmount, fin.currency)}`
        ]);
      }
      // Ligne total accentuée
      finRows.push([
        "Net versé au vendeur",
        formatReceiptMoney(fin.sellerNetAmount, fin.currency)
      ]);
      if (fin.totalCommissionAmount > 0) {
        finRows.push([
          "Total frais plateforme",
          formatReceiptMoney(fin.totalCommissionAmount, fin.currency)
        ]);
      }
      ry = this.drawCompactTable(doc, L + leftW + 12, ry, rightW, finRows, /* highlightLast */ true);

      doc.y = Math.max(ly, ry) + 6;

      this.drawHR(doc, L, W);

      // ── Footer ────────────────────────────────────────────────────────
      const footerY = doc.page.height - MARGIN - 56;
      doc.image(qrPng, L + W - 76, footerY, { width: 72 });
      doc.fontSize(7).fillColor(TEXT_MUTED).font("Helvetica");
      doc.text(
        "Ce reçu est généré automatiquement par FermierPro et constitue une preuve de transaction.",
        L, footerY, { width: W - 90 }
      );
      doc.text("Vérification : " + input.verifyUrl, L, footerY + 13, { width: W - 90 });
      doc.text("Contact : support@fermierpro.com  ·  FermierPro © 2026", L, footerY + 26, { width: W - 90 });

      doc.end();
    });
  }

  private drawHR(doc: PdfDoc, left: number, width: number): void {
    const y = doc.y + 3;
    doc.save().strokeColor("#E5E7EB").lineWidth(0.5);
    doc.moveTo(left, y).lineTo(left + width, y).stroke();
    doc.restore();
    doc.y = y + 6;
  }

  private drawPartyBox(
    doc: PdfDoc,
    x: number,
    y: number,
    width: number,
    title: string,
    party: { fullName: string | null; phone: string | null; farmName: string | null; farmLocation: string | null }
  ): void {
    doc.rect(x, y, width, 56).fill(BRAND_LIGHT);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(BRAND_GREEN);
    doc.text(title.toUpperCase(), x + 8, y + 6, { width: width - 16 });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_DARK);
    doc.text(party.fullName ?? "—", x + 8, y + 18, { width: width - 16 });
    let cy = y + 32;
    doc.font("Helvetica").fontSize(8).fillColor(TEXT_MUTED);
    if (party.farmName) {
      doc.text(`Ferme : ${party.farmName}`, x + 8, cy, { width: width - 16 }); cy += 11;
    }
    if (party.phone) {
      doc.text(`Tél. : ${party.phone}`, x + 8, cy, { width: width - 16 });
    }
  }

  private drawSection(doc: PdfDoc, x: number, y: number, width: number, title: string): number {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND_GREEN);
    doc.text(title.toUpperCase(), x, y, { width });
    return y + 14;
  }

  private drawCompactTable(
    doc: PdfDoc,
    x: number,
    y: number,
    width: number,
    rows: [string, string][],
    highlightLast = false
  ): number {
    const ROW_H = 16;
    const labelW = width * 0.54;

    rows.forEach(([label, value], i) => {
      const isLast = highlightLast && i === rows.length - 1;
      if (isLast) {
        doc.rect(x, y - 1, width, ROW_H + 1).fill(BRAND_LIGHT);
      } else if (i % 2 === 0) {
        doc.rect(x, y - 1, width, ROW_H + 1).fill(ROW_ALT);
      }
      doc.font("Helvetica").fontSize(8).fillColor(TEXT_MUTED);
      doc.text(label, x + 4, y + 2, { width: labelW - 4 });
      doc
        .font(isLast ? "Helvetica-Bold" : "Helvetica-Bold")
        .fontSize(isLast ? 9 : 8)
        .fillColor(isLast ? BRAND_GREEN : TEXT_DARK);
      doc.text(value, x + labelW, y + 2, { width: width - labelW - 4, align: "right" });
      y += ROW_H;
    });
    return y;
  }
}
