/**
 * Adaptateur escrow commande composition (P-J4-B/C).
 *
 * Réutilise EscrowService (holdCompositionFunds / confirmCompositionHold /
 * releaseCompositionFundsToMill / refundCompositionBuyer) — journalisation sur
 * MarketplaceFundMovement.compositionOrderId, sans MarketplaceTransaction fake.
 *
 * Test comparatif obligatoire : montant escrow === finalPriceXof.
 */

/** Test comparatif obligatoire : montant escrow = finalPriceXof. */
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

function roundXof(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}
