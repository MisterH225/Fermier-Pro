import { HistoricalImportService } from "./historical-import.service";

describe("HistoricalImportService", () => {
  const service = new HistoricalImportService(
    {} as never,
    {} as never,
    {} as never
  );

  it("parse un CSV valide", () => {
    const csv = `date,type,categorie,montant,description
2024-01-15,expense,aliments,50000,Aliment démarrage
2024-02-01,income,vente,120000,Vente porcs`;
    const result = service.parseFile(Buffer.from(csv, "utf-8"), "test.csv");
    expect(result.valid_rows).toHaveLength(2);
    expect(result.invalid_rows).toHaveLength(0);
    expect(result.summary.total_expense).toBe(50000);
    expect(result.summary.total_income).toBe(120000);
  });

  it("rejette les lignes invalides", () => {
    const csv = `date,type,categorie,montant
,bad,aliments,100`;
    const result = service.parseFile(Buffer.from(csv, "utf-8"), "bad.csv");
    expect(result.valid_rows).toHaveLength(0);
    expect(result.invalid_rows).toHaveLength(1);
  });
});
