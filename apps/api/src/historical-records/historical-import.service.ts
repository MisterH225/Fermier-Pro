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
import * as Papa from "papaparse";
import * as XLSX from "xlsx";
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

@Injectable()
export class HistoricalImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly profitability: ProfitabilityEngine
  ) {}

  parseFile(fileBuffer: Buffer, filename: string): ParseResult {
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
    } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new BadRequestException("Fichier Excel vide");
      }
      const sheet = workbook.Sheets[sheetName];
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<
        string,
        unknown
      >[];
    } else {
      throw new BadRequestException(
        "Format non supporté. Utilisez CSV, XLS ou XLSX."
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
