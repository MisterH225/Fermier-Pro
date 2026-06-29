import {
  apiDeleteJson,
  apiGetJson,
  apiPostFormData,
  apiPostJson
} from "./http";

export type HistoricalMovementType = "income" | "expense";

export type HistoricalCategory =
  | "achat_animaux"
  | "aliments"
  | "infrastructure"
  | "sante_veterinaire"
  | "main_oeuvre"
  | "transport"
  | "equipement"
  | "autres_depenses"
  | "vente_animaux"
  | "vente_produits_derives"
  | "subventions"
  | "autres_revenus";

export type HistoricalSummaryDto = {
  total_income: number;
  total_expense: number;
  net_result: number;
  by_category: Record<string, number>;
  records_count: number;
};

export type HistoricalRecordDto = {
  id: string;
  farm_id: string;
  movement_type: HistoricalMovementType;
  category: HistoricalCategory;
  amount: string;
  entry_mode: "quick_total" | "import";
  period_start: string | null;
  period_end: string;
  transaction_date: string | null;
  description: string | null;
  import_batch_id: string | null;
  source_filename: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type HistoricalImportPreviewDto = {
  valid_rows: Array<{
    date: string;
    type: HistoricalMovementType;
    categorie: string;
    montant: number;
    description?: string;
  }>;
  invalid_rows: Array<{ row: number; reason: string; data: unknown }>;
  summary: { total_income: number; total_expense: number; count: number };
};

export type CreateQuickTotalPayload = {
  movementType: HistoricalMovementType;
  category: HistoricalCategory;
  amount: number;
  periodStart?: string;
  periodEnd: string;
  notes?: string;
};

export function fetchHistoricalSummary(
  farmId: string,
  accessToken: string,
  activeProfileId?: string | null
): Promise<HistoricalSummaryDto> {
  return apiGetJson<HistoricalSummaryDto>(
    `/farms/${farmId}/historical-records/summary`,
    accessToken,
    activeProfileId
  );
}

export function fetchHistoricalRecords(
  farmId: string,
  accessToken: string,
  activeProfileId?: string | null
): Promise<HistoricalRecordDto[]> {
  return apiGetJson<HistoricalRecordDto[]>(
    `/farms/${farmId}/historical-records`,
    accessToken,
    activeProfileId
  );
}

export function createHistoricalQuickTotal(
  farmId: string,
  payload: CreateQuickTotalPayload,
  accessToken: string,
  activeProfileId?: string | null
): Promise<HistoricalRecordDto> {
  return apiPostJson<HistoricalRecordDto>(
    `/farms/${farmId}/historical-records/quick-total`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function previewHistoricalImport(
  farmId: string,
  file: { uri: string; name: string; mimeType?: string | null },
  accessToken: string,
  activeProfileId?: string | null
): Promise<HistoricalImportPreviewDto> {
  const form = new FormData();
  form.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? "application/octet-stream"
  } as unknown as Blob);
  return apiPostFormData<HistoricalImportPreviewDto>(
    `/farms/${farmId}/historical-records/import/preview`,
    form,
    accessToken,
    activeProfileId
  );
}

export function confirmHistoricalImport(
  farmId: string,
  payload: {
    filename: string;
    rows: HistoricalImportPreviewDto["valid_rows"];
  },
  accessToken: string,
  activeProfileId?: string | null
): Promise<{ inserted: number; batch_id: string }> {
  return apiPostJson(
    `/farms/${farmId}/historical-records/import/confirm`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function deleteHistoricalRecord(
  farmId: string,
  recordId: string,
  accessToken: string,
  activeProfileId?: string | null
): Promise<{ message: string }> {
  return apiDeleteJson(
    `/farms/${farmId}/historical-records/${recordId}`,
    accessToken,
    activeProfileId
  );
}

export function deleteHistoricalImportBatch(
  farmId: string,
  batchId: string,
  accessToken: string,
  activeProfileId?: string | null
): Promise<{ message: string; deleted: number }> {
  return apiDeleteJson(
    `/farms/${farmId}/historical-records/batch/${batchId}`,
    accessToken,
    activeProfileId
  );
}

export const HISTORICAL_EXPENSE_CATEGORIES: HistoricalCategory[] = [
  "achat_animaux",
  "aliments",
  "infrastructure",
  "sante_veterinaire",
  "main_oeuvre",
  "transport",
  "equipement",
  "autres_depenses"
];

export const HISTORICAL_INCOME_CATEGORIES: HistoricalCategory[] = [
  "vente_animaux",
  "vente_produits_derives",
  "subventions",
  "autres_revenus"
];
