import {
  BadRequestException,
  Injectable
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  HistoricalCategory,
  HistoricalEntryMode,
  HistoricalMovementType,
  Prisma
} from "@prisma/client";
import ExcelJS from "exceljs";
import * as Papa from "papaparse";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfitabilityEngine } from "../profitability/profitability.engine";
import type { ConfirmHistoricalImportDto } from "./dto/confirm-historical-import.dto";

export type ParsedHistoricalRow = {
  date: string;
  type: "income" | "expense";
  categorie: string;
  montant: number;
  description?: string;
};

type ParseResult = {
  valid_rows: ParsedHistoricalRow[];
  invalid_rows: { row: number; reason: string; data: unknown }[];
  summary: { total_income: number; total_expense: number; count: number };
};

/** Max upload size for historical import files (Excel / CSV). */
export const HISTORICAL_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

@Injectable()
export class HistoricalImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly profitability: ProfitabilityEngine
  ) {}

  async parseFile(fileBuffer: Buffer, filename: string): Promise<ParseResult> {
    if (fileBuffer.length > HISTORICAL_IMPORT_MAX_BYTES) {
      throw new BadRequestException(
        "Fichier trop volumineux (maximum 10 Mo)."
      );
    }

    const lower = filename.toLowerCase();
    let rawRows: Record<string, unknown>[] = [];

    if (lower.endsWith(".csv")) {
      const text = fileBuffer.toString("utf-8");
      const parsed = Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        transformHeader: (h) => h.trim().toLowerCase()
      });
      if (parsed.errors.length > 0) {
        throw new BadRequestException(
          `Erreur de lecture CSV: ${parsed.errors[0]?.message ?? "format invalide"}`
        );
      }
      rawRows = parsed.data;
    } else if (lower.endsWith(".xls") && !lower.endsWith(".xlsx")) {
      throw new BadRequestException(
        "Le format .xls (Excel 97-2003) n'est plus supporté. Enregistrez le fichier en .xlsx ou utilisez un CSV."
      );
    } else if (lower.endsWith(".xlsx")) {
      try {
        rawRows = await this.parseXlsxBuffer(fileBuffer);
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Erreur de lecture Excel: ${
            error instanceof Error ? error.message : "fichier invalide ou corrompu"
          }`
        );
      }
    } else {
      throw new BadRequestException(
        "Format non supporté. Utilisez CSV ou XLSX."
      );
    }

    const validRows: ParsedHistoricalRow[] = [];
    const invalidRows: ParseResult["invalid_rows"] = [];

    rawRows.forEach((row, index) => {
      const normalized = this.normalizeRow(row);
      const validation = this.validateRow(normalized);
      if (validation.valid) {
        validRows.push(normalized);
      } else {
        invalidRows.push({
          row: index + 2,
          reason: validation.reason ?? "Ligne invalide",
          data: row
        });
      }
    });

    return {
      valid_rows: validRows,
      invalid_rows: invalidRows,
      summary: {
        total_income: validRows
          .filter((r) => r.type === "income")
          .reduce((s, r) => s + r.montant, 0),
        total_expense: validRows
          .filter((r) => r.type === "expense")
          .reduce((s, r) => s + r.montant, 0),
        count: validRows.length
      }
    };
  }

  /**
   * Reads the first worksheet of an .xlsx buffer into row objects
   * (header row → keys), matching SheetJS sheet_to_json({ defval: "" }).
   */
  private async parseXlsxBuffer(
    fileBuffer: Buffer
  ): Promise<Record<string, unknown>[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.actualRowCount === 0) {
      throw new BadRequestException("Fichier Excel vide");
    }

    const headerRow = sheet.getRow(1);
    const headers: { col: number; key: string }[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = String(this.cellToPrimitive(cell.value) ?? "").trim();
      if (key) {
        headers.push({ col: colNumber, key });
      }
    });

    if (!headers.length) {
      throw new BadRequestException("Fichier Excel vide");
    }

    const rawRows: Record<string, unknown>[] = [];

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }
      const obj: Record<string, unknown> = {};
      let hasValue = false;
      for (const { col, key } of headers) {
        const value = this.cellToPrimitive(row.getCell(col).value);
        obj[key] = value === null || value === undefined ? "" : value;
        if (obj[key] !== "") {
          hasValue = true;
        }
      }
      if (hasValue) {
        rawRows.push(obj);
      }
    });

    return rawRows;
  }

  private cellToPrimitive(value: ExcelJS.CellValue): unknown {
    if (value === null || value === undefined) {
      return "";
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }
    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    if (typeof value === "object") {
      if ("richText" in value && Array.isArray(value.richText)) {
        return value.richText.map((t) => t.text).join("");
      }
      if ("text" in value && typeof value.text === "string") {
        return value.text;
      }
      if ("result" in value) {
        return this.cellToPrimitive(value.result as ExcelJS.CellValue);
      }
      if ("error" in value) {
        return "";
      }
    }
    return String(value);
  }

  async confirmImport(
    user: User,
    farmId: string,
    dto: ConfirmHistoricalImportDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    if (!dto.rows.length) {
      throw new BadRequestException("Aucune ligne à importer");
    }

    const batchId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const data = dto.rows.map((row) => {
      const parsedDate = new Date(row.date);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new BadRequestException(`Date invalide: ${row.date}`);
      }
      const movementType =
        row.type === "income"
          ? HistoricalMovementType.income
          : HistoricalMovementType.expense;
      return {
        farmId,
        movementType,
        category: this.mapCategory(row.categorie, row.type),
        amount: new Prisma.Decimal(row.montant),
        entryMode: HistoricalEntryMode.import,
        transactionDate: parsedDate,
        periodEnd: parsedDate,
        description: row.description?.trim() || null,
        importBatchId: batchId,
        sourceFilename: dto.filename
      };
    });

    const result = await this.prisma.historicalRecord.createMany({ data });
    this.profitability.scheduleRecalculate(farmId);
    return { inserted: result.count, batch_id: batchId };
  }

  private normalizeRow(row: Record<string, unknown>): ParsedHistoricalRow {
    const keys = Object.keys(row).reduce<Record<string, unknown>>((acc, k) => {
      acc[k.trim().toLowerCase()] = row[k];
      return acc;
    }, {});

    const montantRaw = keys.montant ?? keys.amount;
    const montant =
      typeof montantRaw === "number"
        ? montantRaw
        : parseFloat(String(montantRaw ?? ""));

    return {
      date: String(keys.date ?? "").trim(),
      type: String(keys.type ?? "")
        .trim()
        .toLowerCase() as "income" | "expense",
      categorie: String(
        keys.categorie ?? keys.catégorie ?? keys.category ?? ""
      )
        .trim()
        .toLowerCase(),
      montant,
      description: keys.description
        ? String(keys.description).trim()
        : undefined
    };
  }

  private validateRow(row: ParsedHistoricalRow): {
    valid: boolean;
    reason?: string;
  } {
    if (!row.date || Number.isNaN(new Date(row.date).getTime())) {
      return { valid: false, reason: "Date invalide ou manquante" };
    }
    if (!["income", "expense"].includes(row.type)) {
      return {
        valid: false,
        reason: 'Type doit être "income" ou "expense"'
      };
    }
    if (!row.categorie) {
      return { valid: false, reason: "Catégorie manquante" };
    }
    if (!row.montant || row.montant <= 0) {
      return { valid: false, reason: "Montant invalide (doit être > 0)" };
    }
    return { valid: true };
  }

  private mapCategory(
    raw: string,
    type: "income" | "expense"
  ): HistoricalCategory {
    const expenseMap: Record<string, HistoricalCategory> = {
      achat: "achat_animaux",
      animaux: "achat_animaux",
      aliment: "aliments",
      nourriture: "aliments",
      construction: "infrastructure",
      infrastructure: "infrastructure",
      sante: "sante_veterinaire",
      veterinaire: "sante_veterinaire",
      "main oeuvre": "main_oeuvre",
      salaire: "main_oeuvre",
      transport: "transport",
      equipement: "equipement"
    };
    const incomeMap: Record<string, HistoricalCategory> = {
      vente: "vente_animaux",
      ventes: "vente_animaux",
      subvention: "subventions",
      produit: "vente_produits_derives"
    };

    const map = type === "expense" ? expenseMap : incomeMap;
    const matched = Object.keys(map).find((key) => raw.includes(key));
    if (matched) {
      return map[matched]!;
    }
    return type === "expense" ? "autres_depenses" : "autres_revenus";
  }
}
