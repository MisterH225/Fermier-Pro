/** Parse un montant saisi (virgule ou point). */
export function parseAmount(raw: string): number | null {
  const n = Number.parseFloat(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Formate un montant API pour champ texte. */
export function amountToInput(amount: string | number): string {
  if (typeof amount === "number") return String(amount);
  const n = Number.parseFloat(amount);
  return Number.isFinite(n) ? String(n) : amount;
}
