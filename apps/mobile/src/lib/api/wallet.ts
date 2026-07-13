import { apiGetJson, apiPostJson } from "./http";
import type { BuyerDashboardDto } from "./buyer";

export type UserWalletEntryKind =
  | "credit_topup"
  | "debit_withdraw"
  | "credit_transfer"
  | "debit_transfer"
  | "credit_escrow_release"
  | "credit_refund"
  | "credit_adjustment"
  | "debit_escrow_hold"
  | "debit_adjustment";

export type BuyerWalletEntryDto = {
  id: string;
  kind: UserWalletEntryKind;
  amount: number;
  balanceAfter: number;
  currency: string;
  transactionId: string | null;
  counterpartyUserId?: string | null;
  providerRef?: string | null;
  note: string | null;
  createdAt: string;
};

export type BuyerWalletEntriesDto = {
  entries: BuyerWalletEntryDto[];
  nextCursor: string | null;
};

/** GET /api/v1/users/me/wallet — route canonique portefeuille. */
export function fetchUserWallet(
  accessToken: string
): Promise<NonNullable<BuyerDashboardDto["wallet"]>> {
  return apiGetJson<NonNullable<BuyerDashboardDto["wallet"]>>(
    "/users/me/wallet",
    accessToken
  );
}

/**
 * GET /api/v1/buyers/me/wallet
 * @deprecated Alias rétrocompat — préférer `fetchUserWallet`. Conservé pour les builds
 * mobile antérieurs ; l'API maintient les deux routes jusqu'à dépréciation explicite.
 */
export function fetchBuyerWallet(
  accessToken: string,
  activeProfileId?: string | null
): Promise<NonNullable<BuyerDashboardDto["wallet"]>> {
  return apiGetJson<NonNullable<BuyerDashboardDto["wallet"]>>(
    "/buyers/me/wallet",
    accessToken,
    activeProfileId
  );
}

export type WalletTopUpInitDto = {
  providerRef?: string;
  amount: number;
  feeAmount?: number;
  netAmount?: number;
  totalDebit?: number;
  amountToReceive?: number;
  currency: string;
  paymentUrl?: string | null;
  phone?: string;
  requiresApproval?: boolean;
  withdrawalRequestId?: string;
  status?: string;
  message?: string;
};

export type WalletFeeQuoteDto = {
  transactionType: "deposit" | "withdrawal" | "transfer";
  amount: number;
  feeAmount: number;
  netAmount: number;
  totalDebit: number;
  isFree: boolean;
};

export type WalletOperationResultDto = {
  ok: boolean;
  balance: number;
  currency: string;
  feeAmount?: number;
  entry: BuyerWalletEntryDto;
};

export function initiateWalletTopUp(
  accessToken: string,
  amount: number
): Promise<WalletTopUpInitDto> {
  return apiPostJson("/users/me/wallet/top-up/initiate", { amount }, accessToken);
}

/** Confirme une recharge — le montant est vérifié côté API/prestataire (pas dans le body). */
export function confirmWalletTopUp(
  accessToken: string,
  providerRef: string
): Promise<WalletOperationResultDto> {
  return apiPostJson(
    "/users/me/wallet/top-up/confirm",
    { providerRef },
    accessToken
  );
}

export function fetchWalletFeeQuote(
  accessToken: string,
  type: "deposit" | "withdrawal" | "transfer",
  amount: number
): Promise<WalletFeeQuoteDto> {
  const params = new URLSearchParams({
    type,
    amount: String(amount)
  });
  return apiGetJson<WalletFeeQuoteDto>(
    `/users/me/wallet/fee-quote?${params.toString()}`,
    accessToken
  );
}

export function initiateWalletWithdraw(
  accessToken: string,
  amount: number,
  phone?: string,
  clientRequestId?: string
): Promise<WalletTopUpInitDto> {
  return apiPostJson(
    "/users/me/wallet/withdraw/initiate",
    { amount, phone, clientRequestId },
    accessToken
  );
}

export function confirmWalletWithdraw(
  accessToken: string,
  amount: number,
  providerRef: string,
  phone?: string,
  withdrawalRequestId?: string
): Promise<WalletOperationResultDto> {
  return apiPostJson(
    "/users/me/wallet/withdraw/confirm",
    { amount, providerRef, phone, withdrawalRequestId },
    accessToken
  );
}

export type WalletTransferRecipientDto = {
  userId: string;
  displayName: string;
  phoneMasked: string;
};

export function fetchWalletTransferRecipient(
  accessToken: string,
  phone: string
): Promise<WalletTransferRecipientDto> {
  const params = new URLSearchParams({ phone: phone.trim() });
  return apiGetJson<WalletTransferRecipientDto>(
    `/users/me/wallet/transfer-recipient?${params.toString()}`,
    accessToken
  );
}

export function transferWalletFunds(
  accessToken: string,
  amount: number,
  recipientPhone: string,
  note?: string
): Promise<{
  ok: boolean;
  balance: number;
  currency: string;
  debit: BuyerWalletEntryDto;
  credit: BuyerWalletEntryDto;
}> {
  return apiPostJson(
    "/users/me/wallet/transfer",
    { amount, recipientPhone, note },
    accessToken
  );
}

/** GET /api/v1/users/me/wallet/entries — route canonique. */
export function fetchUserWalletEntries(
  accessToken: string,
  opts?: { limit?: number; cursor?: string }
): Promise<BuyerWalletEntriesDto> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return apiGetJson<BuyerWalletEntriesDto>(
    `/users/me/wallet/entries${qs ? `?${qs}` : ""}`,
    accessToken
  );
}

/**
 * GET /api/v1/buyers/me/wallet/entries
 * @deprecated Alias rétrocompat — préférer `fetchUserWalletEntries`.
 */
export function fetchBuyerWalletEntries(
  accessToken: string,
  activeProfileId?: string | null,
  opts?: { limit?: number; cursor?: string }
): Promise<BuyerWalletEntriesDto> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return apiGetJson<BuyerWalletEntriesDto>(
    `/buyers/me/wallet/entries${qs ? `?${qs}` : ""}`,
    accessToken,
    activeProfileId
  );
}
