import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { ReceiptPdfInput } from "./receipt.format";
import {
  formatReceiptDate,
  formatReceiptDateOnly,
  formatReceiptMoney,
  shortTransactionId
} from "./receipt.format";

type PdfDoc = InstanceType<typeof PDFDocument>;

const BRAND_GREEN = "#2D6A4F";
const LIGHT_GREY = "#F4F4F5";
const TEXT_DARK = "#1A1A1A";
const TEXT_MUTED = "#6B7280";

@Injectable()
export class ReceiptPdfService {
  async renderReceiptPdf(input: ReceiptPdfInput): Promise<Buffer> {
    const qrPng = await QRCode.toBuffer(input.verifyUrl, {
      type: "png",
      margin: 1,
      width: 120
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 48,
        size: "A4",
        info: {
          Title: `Reçu ${input.receiptNumber}`,
          Author: "FermierPro"
        }
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const left = doc.page.margins.left;

      // Header band
      doc.save();
      doc.rect(left, 48, pageWidth, 72).fill(BRAND_GREEN);
      doc.fillColor("#FFFFFF").fontSize(22).font("Helvetica-Bold");
      doc.text("FermierPro", left + 16, 62);
      doc.fontSize(14).font("Helvetica");
      doc.text("REÇU DE TRANSACTION", left + 16, 88);
      doc.restore();

      doc.y = 136;
      doc.fillColor(TEXT_DARK).font("Helvetica-Bold").fontSize(11);
      doc.text(`N° ${input.receiptNumber}`, left, doc.y);
      doc.font("Helvetica").fontSize(10).fillColor(TEXT_MUTED);
      doc.text(
        `Transaction : ${shortTransactionId(input.transactionId)}`,
        left,
        doc.y + 16
      );
      doc.text(
        `Date d'émission : ${formatReceiptDate(input.issuedAt)}`,
        left,
        doc.y + 14
      );

      doc.moveDown(2);
      this.drawDivider(doc, left, pageWidth);

      // Seller / Buyer columns
      const colW = (pageWidth - 16) / 2;
      const y0 = doc.y + 8;
      this.drawPartyColumn(doc, left, y0, colW, "Vendeur", [
        input.seller.fullName ?? "—",
        input.seller.farmName ? `Ferme : ${input.seller.farmName}` : null,
        input.seller.farmLocation ? `Lieu : ${input.seller.farmLocation}` : null,
        input.seller.phone ? `Tél. : ${input.seller.phone}` : null
      ]);
      this.drawPartyColumn(doc, left + colW + 16, y0, colW, "Acheteur", [
        input.buyer.fullName ?? "—",
        input.buyer.phone ? `Tél. : ${input.buyer.phone}` : null
      ]);
      doc.y = y0 + 88;

      this.drawDivider(doc, left, pageWidth);
      doc.moveDown(0.5);
      doc.fillColor(TEXT_DARK).font("Helvetica-Bold").fontSize(12);
      doc.text("Détails de l'animal", left);
      doc.moveDown(0.4);
      this.drawKeyValueTable(doc, left, pageWidth, [
        ["Identifiant / nom", input.animal.label],
        ["Catégorie", input.animal.categoryLabel],
        [
          "Poids estimé initial",
          input.animal.estimatedWeightKg != null
            ? `${input.animal.estimatedWeightKg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`
            : "—"
        ],
        [
          "Poids réel confirmé",
          input.animal.realWeightKg != null
            ? `${input.animal.realWeightKg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`
            : "—"
        ],
        [
          "Écart poids",
          input.animal.weightDeltaPct != null
            ? `${input.animal.weightDeltaPct >= 0 ? "+" : ""}${input.animal.weightDeltaPct.toFixed(1)} %`
            : "—"
        ]
      ]);

      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(TEXT_DARK);
      doc.text("Récapitulatif financier", left);
      doc.moveDown(0.4);
      const fin = input.financial;
      const finRows: Array<[string, string]> = [
        ["Prix convenu", fin.priceLabel],
        [
          "Poids réel",
          fin.realWeightKg != null
            ? `${fin.realWeightKg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`
            : "—"
        ],
        ["Montant de la transaction", formatReceiptMoney(fin.grossAmount, fin.currency)],
        [
          `Frais plateforme acheteur (${fin.buyerCommissionRatePct.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %)`,
          `+ ${formatReceiptMoney(fin.buyerCommissionAmount, fin.currency)}`
        ],
        [
          "Total payé par l'acheteur",
          formatReceiptMoney(fin.buyerPaidAmount, fin.currency)
        ],
        [
          `Frais plateforme vendeur (${fin.sellerCommissionRatePct.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %)`,
          `- ${formatReceiptMoney(fin.sellerCommissionAmount, fin.currency)}`
        ],
        [
          "Montant net versé au vendeur",
          formatReceiptMoney(fin.sellerNetAmount, fin.currency)
        ],
        [
          "Total frais plateforme",
          formatReceiptMoney(fin.totalCommissionAmount, fin.currency)
        ]
      ];
      if (fin.buyerRefundAmount > 0) {
        finRows.push([
          "Remboursement acheteur",
          formatReceiptMoney(fin.buyerRefundAmount, fin.currency)
        ]);
      }
      if (fin.buyerAdditionalCharge > 0) {
        finRows.push([
          "Paiement supplémentaire acheteur",
          formatReceiptMoney(fin.buyerAdditionalCharge, fin.currency)
        ]);
      }
      this.drawKeyValueTable(doc, left, pageWidth, finRows);

      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(TEXT_DARK);
      doc.text("Chronologie", left);
      doc.moveDown(0.4);
      const tl = input.timeline;
      this.drawKeyValueTable(doc, left, pageWidth, [
        ["Offre acceptée le", formatReceiptDateOnly(tl.offerAcceptedAt)],
        ["Paiement sécurisé le", formatReceiptDateOnly(tl.paymentConfirmedAt)],
        ["Livraison le", formatReceiptDateOnly(tl.pickupDate)],
        ["Poids confirmé le", formatReceiptDateOnly(tl.weightValidatedAt)],
        ["Transaction clôturée le", formatReceiptDateOnly(tl.closedAt)]
      ]);

      this.drawDivider(doc, left, pageWidth);
      doc.moveDown(0.5);

      const footerY = doc.page.height - doc.page.margins.bottom - 100;
      doc.fontSize(8).fillColor(TEXT_MUTED).font("Helvetica");
      doc.text(
        "Ce reçu est généré automatiquement par FermierPro et constitue une preuve de transaction.",
        left,
        footerY,
        { width: pageWidth - 130 }
      );
      doc.text("Contact support : support@fermierpro.com", left, footerY + 28);
      doc.text("FermierPro © 2026", left, footerY + 42);
      doc.image(qrPng, left + pageWidth - 110, footerY - 8, { width: 100 });

      doc.end();
    });
  }

  private drawDivider(doc: PdfDoc, left: number, width: number): void {
    const y = doc.y + 4;
    doc.save();
    doc.strokeColor("#E5E7EB").lineWidth(1);
    doc.moveTo(left, y).lineTo(left + width, y).stroke();
    doc.restore();
    doc.y = y + 10;
  }

  private drawPartyColumn(
    doc: PdfDoc,
    x: number,
    y: number,
    width: number,
    title: string,
    lines: Array<string | null>
  ): void {
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND_GREEN);
    doc.text(title, x, y, { width });
    let cy = y + 18;
    doc.font("Helvetica").fontSize(10).fillColor(TEXT_DARK);
    for (const line of lines) {
      if (!line) continue;
      doc.text(line, x, cy, { width });
      cy += 16;
    }
  }

  private drawKeyValueTable(
    doc: PdfDoc,
    left: number,
    width: number,
    rows: Array<[string, string]>
  ): void {
    const labelW = width * 0.48;
    let y = doc.y;
    rows.forEach(([label, value], i) => {
      if (i % 2 === 0) {
        doc.save();
        doc.rect(left, y - 2, width, 20).fill(LIGHT_GREY);
        doc.restore();
      }
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED);
      doc.text(label, left + 8, y, { width: labelW });
      doc.fillColor(TEXT_DARK).font("Helvetica-Bold");
      doc.text(value, left + labelW, y, { width: width - labelW - 8 });
      y += 22;
    });
    doc.y = y;
  }
}
