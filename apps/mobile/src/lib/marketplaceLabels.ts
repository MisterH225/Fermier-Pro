/** Libellés FR pour les statuts API marketplace (listings / offres). */

export function listingStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Brouillon";
    case "published":
      return "Publiée";
    case "sold":
      return "Vendue";
    case "cancelled":
      return "Annulée";
    default:
      return status;
  }
}

export function offerStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "En attente";
    case "accepted":
      return "Acceptée";
    case "rejected":
      return "Refusée";
    case "withdrawn":
      return "Retirée";
    default:
      return status;
  }
}

/**
 * Enrichit le message d’erreur HTTP (403 scopes ferme) pour l’affichage utilisateur.
 */
export function marketplaceActionErrorMessage(raw: string): string {
  const compact = raw.replace(/\s+/g, " ").trim();
  if (
    compact.includes("marketplace.write") ||
    compact.includes("Permission manquante")
  ) {
    return `${raw}\n\nSi l’annonce est liée à une ferme, ton rôle sur cette ferme doit autoriser le marché en écriture (invitation / scopes).`;
  }
  return raw;
}
