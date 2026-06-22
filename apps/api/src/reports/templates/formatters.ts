/** Formate un entier avec espaces ASCII (compatible pdfmake / Roboto). */
export function formatNumberFr(amount: number): string {
  const rounded = Math.round(amount);
  if (!Number.isFinite(rounded)) return "0";
  const negative = rounded < 0;
  const digits = Math.abs(rounded).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return negative ? `-${grouped}` : grouped;
}

export function formatFcfa(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "0 FCFA";
  return `${formatNumberFr(n)} FCFA`;
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits).replace(".", ",")} %`;
}

export function formatPeriodLabel(
  periodType: string,
  start: string,
  end: string
): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  if (periodType === "monthly") {
    return fmt(s);
  }
  if (periodType === "quarterly") {
    const q = Math.floor(s.getUTCMonth() / 3) + 1;
    return `T${q} ${s.getUTCFullYear()}`;
  }
  if (periodType === "yearly") {
    return String(s.getUTCFullYear());
  }
  return `${s.toLocaleDateString("fr-FR")} – ${e.toLocaleDateString("fr-FR")}`;
}

export function periodTypeBadge(periodType: string): string {
  if (periodType === "monthly") return "RAPPORT MENSUEL";
  if (periodType === "quarterly") return "RAPPORT TRIMESTRIEL";
  if (periodType === "yearly") return "RAPPORT ANNUEL";
  return "RAPPORT D'EXPLOITATION";
}

export function riskLevelLabel(score: number): "FAIBLE" | "MODÉRÉ" | "ÉLEVÉ" {
  if (score >= 80) return "FAIBLE";
  if (score >= 50) return "MODÉRÉ";
  return "ÉLEVÉ";
}

export function scoreInterpretation(score: number): string {
  if (score >= 80) return "Ferme performante";
  if (score >= 50) return "À améliorer";
  return "Critique";
}
