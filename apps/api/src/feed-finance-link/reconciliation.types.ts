export type ReconciliationStockCard = {
  movementId: string;
  feedTypeName: string;
  quantityKg: string;
  occurredAt: string;
  supplier: string | null;
};

export type ReconciliationFinanceCard = {
  expenseId: string;
  amount: string;
  currency: string;
  label: string;
  occurredAt: string;
};

export type ReconciliationCandidateDto = ReconciliationFinanceCard & {
  daysDelta: number;
  movementId?: string;
};

export type ReconciliationOfferDto = {
  status: "single" | "multiple" | "none";
  movementId?: string;
  expenseId?: string;
  stock?: ReconciliationStockCard;
  finance?: ReconciliationFinanceCard;
  candidates?: ReconciliationCandidateDto[];
  calculatedUnitPricePerKg?: number;
  currency?: string;
};

export type MergeReconciliationResultDto = {
  movementId: string;
  expenseId: string;
  unitPricePerKg: number;
  currency: string;
};
