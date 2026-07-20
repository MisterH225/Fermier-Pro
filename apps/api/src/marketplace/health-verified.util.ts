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
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Relance producteur / véto lorsque le badge expire dans exactement N jours. */
export const HEALTH_BADGE_EXPIRY_REMINDER_DAYS = 5;
/** Fenêtre « expiré récemment » pour le CTA in-app producteur. */
export const HEALTH_BADGE_EXPIRED_RECENT_DAYS = 15;

export type HealthVerifiedAppointmentCandidate = {
  farmId: string;
  completedAt: Date;
  vetProfileId: string;
  vetName: string;
  /** Doit être `verified` — les autres sont exclus avant agrégat. */
  vetVerified: boolean;
  /** Optionnel — utilisé pour les relances (notif véto). */
  vetUserId?: string;
};

export type HealthVerifiedFarmInfo = {
  completedAt: Date;
  vetProfileId: string;
  vetName: string;
  vetUserId?: string;
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
        vetName: c.vetName,
        ...(c.vetUserId ? { vetUserId: c.vetUserId } : {})
      });
    }
  }
  return latest;
}

export function healthBadgeExpiresAt(completedAt: Date): Date {
  return new Date(completedAt.getTime() + HEALTH_VERIFIED_WINDOW_MS);
}

/**
 * Jours calendaires restants avant expiration (floor).
 * `null` si le badge n'est plus (ou pas encore) valide.
 */
export function daysUntilHealthBadgeExpiry(
  completedAt: Date,
  now: Date = new Date()
): number | null {
  if (!isWithinHealthVerifiedWindow(completedAt, now)) return null;
  const remainingMs =
    healthBadgeExpiresAt(completedAt).getTime() - now.getTime();
  return Math.floor(remainingMs / MS_PER_DAY);
}

/** True si le badge expire dans exactement `HEALTH_BADGE_EXPIRY_REMINDER_DAYS` jours. */
export function isInHealthBadgeExpiryReminderWindow(
  completedAt: Date,
  now: Date = new Date()
): boolean {
  return (
    daysUntilHealthBadgeExpiry(completedAt, now) ===
    HEALTH_BADGE_EXPIRY_REMINDER_DAYS
  );
}

/**
 * Clé d'idempotence pour une fenêtre d'expiration :
 * 1 notification / ferme / certificat (date de complétion de la visite).
 */
export function healthBadgeExpiryWindowKey(completedAt: Date): string {
  return completedAt.toISOString();
}

/**
 * Dernière visite verified par ferme (sans filtre de fenêtre 30 j).
 * Utilisé par le cron de relance et le CTA « expiré récemment ».
 */
export function aggregateLatestVerifiedVisitByFarm(
  candidates: HealthVerifiedAppointmentCandidate[]
): Map<string, HealthVerifiedFarmInfo> {
  const latest = new Map<string, HealthVerifiedFarmInfo>();
  for (const c of candidates) {
    if (!c.vetVerified) continue;
    const prev = latest.get(c.farmId);
    if (!prev || c.completedAt.getTime() > prev.completedAt.getTime()) {
      latest.set(c.farmId, {
        completedAt: c.completedAt,
        vetProfileId: c.vetProfileId,
        vetName: c.vetName,
        ...(c.vetUserId ? { vetUserId: c.vetUserId } : {})
      });
    }
  }
  return latest;
}

/** Jours depuis l'expiration (0 = jour d'expiration). `null` si encore valide. */
export function daysSinceHealthBadgeExpired(
  completedAt: Date,
  now: Date = new Date()
): number | null {
  const expiresAt = healthBadgeExpiresAt(completedAt);
  const elapsed = now.getTime() - expiresAt.getTime();
  if (elapsed < 0) return null;
  return Math.floor(elapsed / MS_PER_DAY);
}

export function isRecentlyExpiredHealthBadge(
  completedAt: Date,
  now: Date = new Date()
): boolean {
  const days = daysSinceHealthBadgeExpired(completedAt, now);
  return days != null && days < HEALTH_BADGE_EXPIRED_RECENT_DAYS;
}
