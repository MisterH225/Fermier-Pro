import type { TFunction } from "i18next";
import { getUserFacingError } from "./userFacingError";

/** Libellés FR pour les statuts API marketplace (listings / offres). */

export function listingStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Brouillon";
    case "published":
      return "Publiée";
    case "reserved":
      return "Réservée";
    case "shipped":
      return "Envoi confirmé";
    case "delivered":
      return "Livraison confirmée";
    case "disputed":
      return "Litige en cours";
    case "sold":
      return "Vendue";
    case "cancelled":
      return "Annulée";
    case "expired":
      return "Expirée";
    default:
      return status;
  }
}

export function projectMarketplaceFinalAmount(params: {
  priceType: string;
  agreedPricePerKg: number | null;
  agreedFlatPrice: number | null;
  realWeightKg: number | null;
  draftWeightKg?: number | null;
}): number | null {
  if (params.priceType === "flat") {
    return params.agreedFlatPrice;
  }
  const perKg = params.agreedPricePerKg;
  if (perKg == null || perKg <= 0) {
    return null;
  }
  const weight = params.realWeightKg ?? params.draftWeightKg ?? null;
  if (weight == null || weight <= 0) {
    return null;
  }
  return perKg * weight;
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
    case "countered":
      return "Contre-proposition";
    case "credit_agreed":
      return "Accord crédit";
    case "advance_confirmed":
      return "Avance confirmée";
    case "balance_pending":
      return "Solde en attente";
    case "balance_declared":
      return "Solde déclaré";
    case "arbitration":
      return "Arbitrage";
    case "cancelled":
      return "Annulée";
    case "completed":
      return "Terminée";
    default:
      return status;
  }
}

/**
 * Enrichit le message d’erreur HTTP (403 scopes ferme) pour l’affichage utilisateur.
 */
export function marketplaceActionErrorMessage(err: unknown, t: TFunction): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : err != null
          ? String(err)
          : "";
  const compact = raw.replace(/\s+/g, " ").trim();
  const base = getUserFacingError(err, t);
  if (compact === "MARKETPLACE_PAYMENT_ALREADY_HELD") {
    return t("marketScreen.transaction.paymentAlreadyHeldBody");
  }
  if (compact.startsWith("MARKETPLACE_PAYMENT_INVALID_STATUS:")) {
    const status = compact.split(":")[1] ?? "";
    return t("marketScreen.transaction.paymentInvalidStatus", {
      status,
      defaultValue: `Statut actuel : ${status}. Rechargez l'écran ou créez une nouvelle transaction.`
    });
  }
  if (
    compact.includes("marketplace.write") ||
    compact.includes("Permission manquante")
  ) {
    return `${base}\n\nSi l’annonce est liée à une ferme, ton rôle sur cette ferme doit autoriser le marché en écriture (invitation / scopes).`;
  }
  return base;
}
