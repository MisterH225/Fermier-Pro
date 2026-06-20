import type { BuyerWalletEntryDto } from "../../lib/api";

type WalletEntryIconName =
  | "arrow-down-circle"
  | "arrow-up-circle"
  | "swap-horizontal";

export function walletEntryLabel(
  kind: BuyerWalletEntryDto["kind"],
  t: (key: string) => string
): string {
  switch (kind) {
    case "credit_topup":
      return t("buyer.wallet.entry.topUp");
    case "debit_withdraw":
      return t("buyer.wallet.entry.withdraw");
    case "credit_transfer":
      return t("buyer.wallet.entry.transferIn");
    case "debit_transfer":
      return t("buyer.wallet.entry.transferOut");
    case "credit_escrow_release":
      return t("buyer.wallet.entry.escrowRelease");
    case "credit_refund":
      return t("buyer.wallet.entry.refund");
    case "credit_adjustment":
      return t("buyer.wallet.entry.creditAdjustment");
    case "debit_escrow_hold":
      return t("buyer.wallet.entry.purchase");
    case "debit_adjustment":
      return t("buyer.wallet.entry.debitAdjustment");
    default:
      return kind;
  }
}

export function walletEntryIcon(
  kind: BuyerWalletEntryDto["kind"]
): WalletEntryIconName {
  switch (kind) {
    case "credit_topup":
    case "credit_transfer":
    case "credit_escrow_release":
    case "credit_refund":
    case "credit_adjustment":
      return "arrow-down-circle";
    case "debit_withdraw":
    case "debit_transfer":
    case "debit_escrow_hold":
    case "debit_adjustment":
      return "arrow-up-circle";
    default:
      return "swap-horizontal";
  }
}

export function isWalletEntryCredit(kind: BuyerWalletEntryDto["kind"]): boolean {
  return (
    kind === "credit_topup" ||
    kind === "credit_transfer" ||
    kind === "credit_escrow_release" ||
    kind === "credit_refund" ||
    kind === "credit_adjustment"
  );
}
