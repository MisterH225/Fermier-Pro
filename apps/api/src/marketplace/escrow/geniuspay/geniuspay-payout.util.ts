import type { GeniusPayPayoutData, GeniusPayPayoutMetadata } from "./geniuspay.types";

/** Normalise un numéro ivoirien vers le format international +225… */
export function normalizeCiMobilePhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("225") && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+225${digits}`;
  }
  if (trimmed.startsWith("+")) {
    return trimmed;
  }
  return `+${digits}`;
}

export function parsePayoutMetadata(
  raw: Record<string, string | number | boolean | null> | undefined
): GeniusPayPayoutMetadata | null {
  if (!raw) {
    return null;
  }
  const kind = raw.kind;
  const userId = raw.user_id;
  if (typeof kind !== "string" || typeof userId !== "string" || !userId.trim()) {
    return null;
  }
  return {
    kind: kind as GeniusPayPayoutMetadata["kind"],
    user_id: userId,
    transaction_id:
      typeof raw.transaction_id === "string" ? raw.transaction_id : undefined,
    amount:
      raw.amount !== undefined && raw.amount !== null
        ? String(raw.amount)
        : undefined,
    withdrawal_request_id:
      typeof raw.withdrawal_request_id === "string"
        ? raw.withdrawal_request_id
        : undefined
  };
}

export function payoutProviderFromEnv(): string | null {
  return process.env.GENIUSPAY_PAYOUT_PROVIDER?.trim() || null;
}

export async function waitForPayoutCompletion(
  lookup: (reference: string) => Promise<GeniusPayPayoutData | null>,
  reference: string,
  options?: { attempts?: number; delayMs?: number }
): Promise<GeniusPayPayoutData | null> {
  const attempts = options?.attempts ?? 6;
  const delayMs = options?.delayMs ?? 2000;

  for (let i = 0; i < attempts; i++) {
    const payout = await lookup(reference);
    if (!payout) {
      return null;
    }
    if (payout.status === "completed") {
      return payout;
    }
    if (payout.status === "failed" || payout.status === "cancelled") {
      return payout;
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return lookup(reference);
}
