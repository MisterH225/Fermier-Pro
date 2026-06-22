import type { ScoreBreakdown } from "../reports-score.util";
import type { ReportBankScoring } from "./farm-report.types";
import { formatFcfa, formatPct } from "./formatters";

function scoreComment(score: number, good: string, mid: string, low: string): string {
  if (score >= 75) return good;
  if (score >= 50) return mid;
  return low;
}

export function financeSectionAnalysis(
  revenues: number,
  expenses: number,
  net: number,
  marginPct: number | null
): string {
  if (revenues <= 0 && expenses <= 0) {
    return "Peu de mouvements financiers enregistrés sur la période. Une saisie régulière renforcera la fiabilité du rapport.";
  }
  if (net < 0) {
    return `La période affiche un déficit de ${formatFcfa(Math.abs(net))}. Les dépenses dépassent les revenus : prioriser le suivi des charges et la valorisation des ventes.`;
  }
  const marginTxt =
    marginPct != null ? ` avec une marge nette de ${formatPct(marginPct)}` : "";
  return `Situation financière positive${marginTxt}. Les revenus (${formatFcfa(revenues)}) couvrent les dépenses (${formatFcfa(expenses)}) avec un bénéfice net de ${formatFcfa(net)}.`;
}

export function cheptelSectionAnalysis(
  total: number,
  headcountDeltaPct: number | null
): string {
  const trend =
    headcountDeltaPct == null
      ? "L'évolution du cheptel n'est pas comparable faute de données antérieures."
      : headcountDeltaPct >= 0
        ? `Le cheptel progresse de ${formatPct(headcountDeltaPct)} par rapport à la période précédente.`
        : `Le cheptel recule de ${formatPct(Math.abs(headcountDeltaPct))} : vérifier les sorties et mortalités.`;
  return `Effectif actuel de ${total} tête(s). ${trend}`;
}

export function healthSectionAnalysis(
  mortalityPct: number,
  vaccineOverdue: number,
  breakdown: ScoreBreakdown
): string {
  const mortNote =
    mortalityPct > 4
      ? "Taux de mortalité élevé — renforcer la surveillance sanitaire."
      : mortalityPct > 2
        ? "Mortalité modérée — maintenir la prévention."
        : "Mortalité maîtrisée sur la période.";
  const vaccNote =
    vaccineOverdue > 0
      ? `${vaccineOverdue} vaccin(s) en retard à planifier.`
      : "Calendrier vaccinal à jour.";
  return `${mortNote} ${vaccNote} ${breakdown.herdHealth.detail}`;
}

export function feedSectionAnalysis(
  stockDays: number | null,
  alertLevel: "green" | "amber" | "red"
): string {
  if (stockDays == null || stockDays <= 0) {
    return "Stock d'alimentation non renseigné ou critique. Un suivi des entrées/sorties améliore la visibilité sur les coûts.";
  }
  if (alertLevel === "red") {
    return `Stock estimé à ${stockDays} jour(s) seulement — réapprovisionnement urgent recommandé.`;
  }
  if (alertLevel === "amber") {
    return `Stock couvrant environ ${stockDays} jour(s) : anticiper la commande pour éviter une rupture.`;
  }
  return `Stock confortable (${stockDays} jour(s) estimés). La gestion alimentaire contribue positivement à la performance globale.`;
}

export function profitabilitySectionAnalysis(available: boolean, netMarginPct: number | null): string {
  if (!available) {
    return "Données insuffisantes pour calculer la rentabilité détaillée. Enregistrez ventes, coûts alimentaires et charges pour activer cette analyse.";
  }
  if (netMarginPct == null) return "Rentabilité calculée sur les données disponibles ; complétez les coûts pour affiner l'analyse.";
  if (netMarginPct >= 15) return `Rentabilité solide (marge nette ${formatPct(netMarginPct)}). L'exploitation dégage une marge confortable.`;
  if (netMarginPct >= 0) return `Rentabilité positive mais modérée (${formatPct(netMarginPct)}). Optimiser les coûts et les prix de vente.`;
  return `Marge nette négative (${formatPct(netMarginPct)}). Action corrective sur les charges et le prix de vente recommandée.`;
}

export function predictionsSectionAnalysis(available: boolean, insufficientData: boolean): string {
  if (!available || insufficientData) {
    return "Les prévisions IA nécessitent au moins 30 jours d'historique. Continuez la saisie pour débloquer les projections financières et sanitaires.";
  }
  return "Projections basées sur l'historique récent de la ferme. À utiliser comme aide à la décision, en complément du suivi terrain.";
}

export function marketplaceSectionAnalysis(salesCount: number, unsoldCount: number): string {
  if (salesCount === 0 && unsoldCount === 0) {
    return "Aucune activité marketplace enregistrée sur la période. Les ventes en ligne peuvent diversifier les débouchés.";
  }
  if (unsoldCount > 0) {
    return `${salesCount} vente(s) conclue(s) ; ${unsoldCount} annonce(s) encore en ligne. Ajuster prix ou visibilité pour accélérer les sorties.`;
  }
  return `${salesCount} vente(s) réalisée(s) sur la période. L'activité marketplace contribue aux revenus de l'exploitation.`;
}

export function bankGlobalRiskAnalysis(
  scoreGlobal: number,
  riskLevel: ReportBankScoring["riskLevel"]
): string {
  if (riskLevel === "FAIBLE") {
    return `Profil globalement favorable (score ${scoreGlobal}/100). L'exploitation présente un niveau de risque maîtrisé pour un financement.`;
  }
  if (riskLevel === "MODÉRÉ") {
    return `Profil équilibré (score ${scoreGlobal}/100) avec quelques points de vigilance. Un accompagnement technique peut renforcer la solidité du dossier.`;
  }
  return `Profil sensible (score ${scoreGlobal}/100). Des mesures correctives sur la santé, les finances ou la saisie des données sont recommandées avant un financement.`;
}

export function bankRiskAxisAnalysis(
  axis: "sanitaire" | "financier" | "operationnel",
  score: number,
  breakdown: ScoreBreakdown
): string {
  const detail =
    axis === "sanitaire"
      ? breakdown.herdHealth.detail
      : axis === "financier"
        ? breakdown.financialHealth.detail
        : `${breakdown.productivity.detail} ${breakdown.dataRegularity.detail}`;
  return scoreComment(
    score,
    `Risque faible (${score}/100). ${detail}`,
    `Risque modéré (${score}/100). Surveillance recommandée. ${detail}`,
    `Risque élevé (${score}/100). Action prioritaire. ${detail}`
  );
}

export function bankFinancialSummaryAnalysis(
  avgMonthlyRevenue: number,
  net: number,
  herdGrowthPct: number | null
): string {
  const revNote =
    avgMonthlyRevenue > 0
      ? `Revenu mensuel moyen estimé à ${formatFcfa(avgMonthlyRevenue)}.`
      : "Revenus mensuels faibles ou irréguliers.";
  const netNote =
    net >= 0
      ? `Résultat net positif de ${formatFcfa(net)} sur la période.`
      : `Déficit de ${formatFcfa(Math.abs(net))} à surveiller.`;
  const herdNote =
    herdGrowthPct != null
      ? ` Croissance cheptel : ${formatPct(herdGrowthPct)}.`
      : "";
  return `${revNote} ${netNote}${herdNote}`;
}
