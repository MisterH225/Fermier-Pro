import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { OrderCard } from "../OrderCard";

const mockExistsKeys = new Set([
  "orders.trackingNumber",
  "orders.nextAction",
  "orders.hub.type.escrow",
  "orders.hub.counterpartyFallback",
  "orders.hub.itemSummary.escrow",
  "orders.hub.itemSummary.shop",
  "orders.hub.statusFallback",
  "orders.action.pay",
  "orders.action.generic",
  "orders.hub.escrowStatus.PAYMENT_PENDING"
]);

const mockTranslations: Record<string, string> = {
  "orders.trackingNumber": "N° de suivi",
  "orders.nextAction": "Prochaine action : {{action}}",
  "orders.hub.type.escrow": "Marketplace",
  "orders.hub.counterpartyFallback": "Utilisateur",
  "orders.hub.itemSummary.escrow": "Commande marketplace",
  "orders.hub.itemSummary.shop": "Commande boutique",
  "orders.hub.statusFallback": "En cours",
  "orders.action.pay": "Payer",
  "orders.action.generic": "Ouvrir la commande",
  "orders.hub.escrowStatus.PAYMENT_PENDING": "Paiement en attente"
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const raw = mockTranslations[key] ?? key;
      if (!params) return raw;
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
        raw
      );
    },
    i18n: {
      language: "fr",
      exists: (key: string) => mockExistsKeys.has(key)
    }
  })
}));

jest.mock("@expo/vector-icons", () => {
  const ReactModule = require("react") as typeof React;
  return {
    Ionicons: (props: Record<string, unknown>) =>
      ReactModule.createElement("Icon", props)
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function render(props: Partial<React.ComponentProps<typeof OrderCard>> = {}) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      React.createElement(OrderCard, {
        reference: "tx-1",
        counterparty: "Ferme Dupont",
        amount: 5000,
        currency: "XOF",
        statusLabelKey: "orders.hub.escrowStatus.PAYMENT_PENDING",
        statusTone: "pending",
        typeLabelKey: "orders.hub.type.escrow",
        actionRequiredByMe: true,
        nextActionKey: "orders.action.pay",
        ...props
      })
    );
  });
  const json = JSON.stringify(renderer.toJSON());
  act(() => {
    renderer.unmount();
  });
  return json;
}

describe("OrderCard — pas de texte technique", () => {
  it("traduit la prochaine action connue", () => {
    const out = render();
    expect(out).toContain("Prochaine action : Payer");
    expect(out).not.toContain("orders.action.pay");
  });

  it("utilise l'action générique si la clé i18n est absente", () => {
    const out = render({ nextActionKey: "orders.action.unknown" });
    expect(out).toContain("Prochaine action : Ouvrir la commande");
    expect(out).not.toContain("orders.action.unknown");
  });

  it("localise les fallbacks backend itemSummary / contrepartie", () => {
    const out = render({
      counterparty: "Utilisateur",
      itemSummary: "Commande marketplace"
    });
    expect(out).toContain("Commande marketplace");
    expect(out).toContain("Utilisateur");
  });

  it("n'affiche pas de clé de statut brute quand la clé existe", () => {
    const out = render();
    expect(out).toContain("Paiement en attente");
    expect(out).not.toContain("orders.hub.escrowStatus.PAYMENT_PENDING");
  });
});
