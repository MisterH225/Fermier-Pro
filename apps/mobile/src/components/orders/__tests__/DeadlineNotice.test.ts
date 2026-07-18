import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { DeadlineNotice } from "../DeadlineNotice";
import { fr } from "../../../i18n/fr";

// t renvoie la clé (+ params sérialisés) pour vérifier quelle branche s'affiche.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}|${JSON.stringify(params)}` : key,
    i18n: { language: "fr" }
  })
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function render(deadlineAt: string, outcomeKey?: string): string {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      React.createElement(DeadlineNotice, { deadlineAt, outcomeKey })
    );
  });
  const json = JSON.stringify(renderer.toJSON());
  act(() => {
    renderer.unmount();
  });
  return json;
}

describe("DeadlineNotice — date vs compte à rebours", () => {
  it("affiche la DATE quand l'échéance est > 24 h", () => {
    const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const out = render(inThreeDays.toISOString());
    expect(out).toContain("deadline.byDate");
    expect(out).not.toContain("deadline.countdown");
  });

  it("affiche un COMPTE À REBOURS quand l'échéance est < 24 h", () => {
    const inThreeHours = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const out = render(inThreeHours.toISOString());
    expect(out).toContain("deadline.countdownHours");
    expect(out).not.toContain("deadline.byDate");
  });

  it("affiche « échéance dépassée » quand la date est passée", () => {
    const past = new Date(Date.now() - 60_000);
    expect(render(past.toISOString())).toContain("deadline.overdue");
  });

  it("rend la phrase de conséquence quand outcomeKey est fourni", () => {
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const out = render(soon.toISOString(), "deadline.outcome.shopConfirmRefund");
    expect(out).toContain("deadline.outcome.shopConfirmRefund");
  });
});

describe("phrase = comportement du cron (test croisé P-43)", () => {
  const outcome = fr.deadline.outcome;

  it("boutique paid (cron rembourse) → la phrase promet le remboursement", () => {
    // Cron runTrackingCycle : refundEscrow → statut refunded.
    expect(outcome.shopConfirmRefund.toLowerCase()).toContain("rembours");
  });

  it("boutique delivered (cron paie le vendeur) → la phrase dit vendeur payé", () => {
    // Cron : releaseEscrow → completed (payout vendeur).
    expect(outcome.shopAutoComplete.toLowerCase()).toContain("payé");
    expect(outcome.shopAutoComplete.toLowerCase()).not.toContain("rembours");
  });

  it("expiration d'offre (cron rejette, ne rembourse pas) → aucune promesse de remboursement", () => {
    // Cron expireStaleOffers : status rejected, aucun mouvement d'argent.
    expect(outcome.offerProposalExpire.toLowerCase()).not.toContain("rembours");
    expect(outcome.offerProposalExpire.toLowerCase()).toContain("expir");
  });

  it("paiement escrow expiré (rien n'est bloqué) → pas de promesse de remboursement", () => {
    // Cron handleExpiredPayments : OFFER_EXPIRED, aucun remboursement.
    expect(outcome.offerPaymentExpire.toLowerCase()).not.toContain("rembours");
    expect(outcome.offerPaymentExpire.toLowerCase()).toContain("annul");
  });
});
