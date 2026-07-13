import { BadRequestException } from "@nestjs/common";
import ExcelJS from "exceljs";
import {
  HISTORICAL_IMPORT_MAX_BYTES,
  HistoricalImportService
} from "./historical-import.service";

describe("HistoricalImportService", () => {
  const service = new HistoricalImportService(
    {} as never,
    {} as never,
    {} as never
  );

  async function buildXlsxBuffer(
    rows: (string | number)[][]
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Import");
    for (const row of rows) {
      sheet.addRow(row);
    }
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  it("parse un CSV valide", async () => {
    const csv = `date,type,categorie,montant,description
2024-01-15,expense,aliments,50000,Aliment démarrage
2024-02-01,income,vente,120000,Vente porcs`;
    const result = await service.parseFile(Buffer.from(csv, "utf-8"), "test.csv");
    expect(result.valid_rows).toHaveLength(2);
    expect(result.invalid_rows).toHaveLength(0);
    expect(result.summary.total_expense).toBe(50000);
    expect(result.summary.total_income).toBe(120000);
  });

  it("rejette les lignes invalides", async () => {
    const csv = `date,type,categorie,montant
,bad,aliments,100`;
    const result = await service.parseFile(Buffer.from(csv, "utf-8"), "bad.csv");
    expect(result.valid_rows).toHaveLength(0);
    expect(result.invalid_rows).toHaveLength(1);
  });

  it("parse un XLSX généré (structure iso CSV)", async () => {
    const buffer = await buildXlsxBuffer([
      ["date", "type", "categorie", "montant", "description"],
      ["2024-01-15", "expense", "aliments", 50000, "Aliment démarrage"],
      ["2024-02-01", "income", "vente", 120000, "Vente porcs"]
    ]);

    // exceljs relit ce qu'il a produit
    const verify = new ExcelJS.Workbook();
    await verify.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect(verify.worksheets).toHaveLength(1);
    expect(verify.worksheets[0]!.getRow(1).getCell(1).value).toBe("date");
    expect(verify.worksheets[0]!.rowCount).toBe(3);

    const result = await service.parseFile(buffer, "historique.xlsx");
    expect(result.valid_rows).toHaveLength(2);
    expect(result.invalid_rows).toHaveLength(0);
    expect(result.valid_rows[0]).toMatchObject({
      date: "2024-01-15",
      type: "expense",
      categorie: "aliments",
      montant: 50000,
      description: "Aliment démarrage"
    });
    expect(result.valid_rows[1]).toMatchObject({
      date: "2024-02-01",
      type: "income",
      categorie: "vente",
      montant: 120000,
      description: "Vente porcs"
    });
    expect(result.summary).toEqual({
      total_income: 120000,
      total_expense: 50000,
      count: 2
    });
  });

  it("rejette un fichier trop volumineux", async () => {
    const huge = Buffer.alloc(HISTORICAL_IMPORT_MAX_BYTES + 1);
    await expect(service.parseFile(huge, "big.xlsx")).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("rejette le format .xls legacy", async () => {
    await expect(
      service.parseFile(Buffer.from("not-xls"), "legacy.xls")
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
