import { ServiceUnavailableException } from "@nestjs/common";

/**
 * Adaptateur escrow pour commande composition (P-J4-B).
 *
 * STOP — ne PAS dupliquer le circuit de paiement / remboursement.
 *
 * Constat (juillet 2026) :
 * - `EscrowService.holdFunds(transactionId, …)` journalise dans
 *   `MarketplaceFundMovement.transactionId` → FK obligatoire vers
 *   `MarketplaceTransaction`.
 * - `MarketplaceTransactionService.createFromAcceptedOffer` est couplé à
 *   `MarketplaceOffer` / listing livestock (poids, pickup, etc.).
 * - `UserWalletEntry` référence `transactionId` | `merchantOrderId` |
 *   `vetAppointmentId` — pas encore `compositionOrderId`.
 *
 * Donc on ne peut PAS appeler l'escrow « tel quel » avec seulement
 * `CompositionOrder.finalPriceXof` sans étendre le schéma des mouvements
 * de fonds (ou introduire une intention de paiement générique).
 *
 * Ce module expose :
 * 1. la vérification comparative obligatoire montant escrow = finalPriceXof
 * 2. un point d'arrêt explicite jusqu'à l'extension escrow (pas de silo).
 */

export const ESCROW_COMPOSITION_ADAPTER_CODE =
  "ESCROW_COMPOSITION_ADAPTER_REQUIRED" as const;

/** Test comparatif obligatoire : montant escrow === finalPriceXof. */
export function assertEscrowAmountEqualsFinalPrice(
  escrowAmountXof: number,
  finalPriceXof: number
): void {
  const a = roundXof(escrowAmountXof);
  const b = roundXof(finalPriceXof);
  if (a !== b) {
    throw new Error(
      `Montant escrow (${a}) ≠ finalPriceXof (${b}) — refus de créer le séquestre.`
    );
  }
}

/**
 * Point d'entrée paiement composition.
 * Refuse toute duplication : explique le gap au lieu d'inventer un circuit.
 */
export function refuseCompositionEscrowUntilAdapterReady(opts: {
  compositionOrderId: string;
  finalPriceXof: number;
}): never {
  assertEscrowAmountEqualsFinalPrice(
    opts.finalPriceXof,
    opts.finalPriceXof
  );
  throw new ServiceUnavailableException({
    statusCode: 503,
    code: ESCROW_COMPOSITION_ADAPTER_CODE,
    message:
      "Le séquestre marketplace ne peut pas encore encaisser une commande composition : " +
      "EscrowService exige un MarketplaceTransaction (FundMovement FK). " +
      "Étendre le schéma (compositionOrderId sur les mouvements / portefeuille) " +
      "puis brancher holdFunds — sans dupliquer paiement ni remboursement. " +
      `Commande ${opts.compositionOrderId}, montant prévu ${opts.finalPriceXof} XOF.`,
    finalPriceXof: opts.finalPriceXof,
    compositionOrderId: opts.compositionOrderId
  });
}

function roundXof(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}
