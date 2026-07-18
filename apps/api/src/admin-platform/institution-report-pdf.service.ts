import { Injectable } from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfMake = require("pdfmake/build/pdfmake");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfFonts = require("pdfmake/build/vfs_fonts");
import { buildInstitutionStatsReportDocDefinition } from "./institution-report-pdf.template";
import type { InstitutionReportSectionData } from "./institution-report.constants";
import type { ReportLocale } from "./institution-report.i18n";

type PdfFontVfs = Record<string, string>;

function resolvePdfmakeVfs(raw: Record<string, unknown>): PdfFontVfs {
  const nested =
    (raw.pdfMake as { vfs?: PdfFontVfs } | undefined)?.vfs ??
    (raw.vfs as PdfFontVfs | undefined);
  if (nested) {
    return nested;
  }
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

@Injectable()
export class InstitutionReportPdfService {
  async buildPdf(input: {
    institutionLabel: string | null;
    from: string;
    to: string;
    coverage: InstitutionReportSectionData["coverage"];
    sections: InstitutionReportSectionData[];
    locale?: ReportLocale;
  }): Promise<Buffer> {
    const docDefinition = buildInstitutionStatsReportDocDefinition(input);
    const pdf = pdfMake.createPdf(docDefinition);
    return new Promise<Buffer>((resolve, reject) => {
      pdf.getBuffer((buffer: Buffer) => {
        if (!buffer) {
          reject(new Error("Génération PDF échouée"));
          return;
        }
        resolve(buffer);
      });
    });
  }
}
