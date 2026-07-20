/**
 * Badge « Santé vérifiée » — fenêtre de validité et agrégat pur.
 *
 * Anti-triche : uniquement des RDV/consultations terminaux en base,
 * réalisés par un vétérinaire `verified`. Jamais de déclaratif producteur
 * (ex. FarmHealthRecord.vet_visit).
 *
 * Calcul à la lecture (batch par farmIds) plutôt qu'une colonne dénormalisée :
 * le coût reste O(farms de la page) avec une seule requête `IN` + filtre
 * statut — prohibitif seulement si on charge des milliers d'annonces sans
 * pagination. On évite ainsi la dette de sync à chaque APPOINTMENT_COMPLETED.
 */

export const HEALTH_VERIFIED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type HealthVerifiedAppointmentCandidate = {
  farmId: string;
  completedAt: Date;
  vetProfileId: string;
  vetName: string;
  /** Doit être `verified` — les autres sont exclus avant agrégat. */
  vetVerified: boolean;
};

export type HealthVerifiedFarmInfo = {
  completedAt: Date;
  vetProfileId: string;
  vetName: string;
};

/** True si `completedAt` tombe dans la fenêtre [now - 30j, now]. */
export function isWithinHealthVerifiedWindow(
  completedAt: Date,
  now: Date = new Date()
): boolean {
  const t = completedAt.getTime();
  if (!Number.isFinite(t)) return false;
  const elapsed = now.getTime() - t;
  return elapsed >= 0 && elapsed < HEALTH_VERIFIED_WINDOW_MS;
}

/**
 * Agrège les candidats : 1 entrée / ferme = dernière complétion valide
 * (véto verified + fenêtre 30 j).
 */
export function aggregateHealthVerifiedByFarm(
  candidates: HealthVerifiedAppointmentCandidate[],
  now: Date = new Date()
): Map<string, HealthVerifiedFarmInfo> {
  const latest = new Map<string, HealthVerifiedFarmInfo>();
  for (const c of candidates) {
    if (!c.vetVerified) continue;
    if (!isWithinHealthVerifiedWindow(c.completedAt, now)) continue;
    const prev = latest.get(c.farmId);
    if (!prev || c.completedAt.getTime() > prev.completedAt.getTime()) {
      latest.set(c.farmId, {
        completedAt: c.completedAt,
        vetProfileId: c.vetProfileId,
        vetName: c.vetName
      });
    }
  }
  return latest;
}
