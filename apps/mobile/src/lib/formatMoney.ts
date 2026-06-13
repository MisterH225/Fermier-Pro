/** Formatage monétaire partagé (finance ferme + marketplace). */

export function formatFarmMoney(
  amount: string | number,
  currencyCode: string,
  currencySymbol?: string
): string {
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(n)) {
    return String(amount);
  }
  const iso = currencyCode?.length === 3 ? currencyCode : "XOF";
  try {
    const s = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: iso,
      maximumFractionDigits: 0
    }).format(n);
    return currencySymbol && iso === "XOF" && currencySymbol !== "XOF"
      ? s.replace("F CFA", currencySymbol).replace("FCFA", currencySymbol)
      : s;
  } catch {
    return `${Math.round(n).toLocaleString("fr-FR")} ${currencySymbol ?? iso}`;
  }
}

export function formatMarketMoney(n: number, currency: string): string {
  return formatFarmMoney(n, currency);
}

export function formatPricePerKg(
  amount: number,
  currencyCode: string,
  currencySymbol?: string
): string {
  return `${formatFarmMoney(amount, currencyCode, currencySymbol)}/kg`;
}
