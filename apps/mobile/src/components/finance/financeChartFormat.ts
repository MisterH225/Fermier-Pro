/** Libellé court pour les valeurs au-dessus des barres (ex. 95k, 1,2M). */
export function formatFinanceChartValue(
  amount: number,
  currencySymbol?: string
): string {
  if (!Number.isFinite(amount)) {
    return "—";
  }
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  let core: string;
  if (abs >= 1_000_000) {
    core = `${(abs / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}M`;
  } else if (abs >= 10_000) {
    core = `${Math.round(abs / 1000)}k`;
  } else if (abs >= 1_000) {
    core = `${(abs / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}k`;
  } else {
    core = abs.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  }
  const sym = currencySymbol?.trim();
  return sym && sym.length <= 4 ? `${sign}${core} ${sym}` : `${sign}${core}`;
}
