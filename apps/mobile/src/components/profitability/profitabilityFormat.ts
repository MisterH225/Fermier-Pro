export function formatProfitMoney(
  value: number | null | undefined,
  currencyCode: string,
  currencySymbol?: string
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const iso = currencyCode?.length === 3 ? currencyCode : "XOF";
  try {
    const s = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: iso,
      maximumFractionDigits: 0
    }).format(value);
    return currencySymbol && iso === "XOF" && currencySymbol !== "XOF"
      ? s.replace("F CFA", currencySymbol).replace("FCFA", currencySymbol)
      : s;
  } catch {
    return `${Math.round(value)} ${currencySymbol ?? currencyCode}`;
  }
}

export function formatIc(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}
