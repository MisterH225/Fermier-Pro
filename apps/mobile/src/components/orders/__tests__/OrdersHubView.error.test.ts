import React from "react";
import { Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const mockTranslations: Record<string, string> = {
  "orders.hub.loadError": "Impossible de charger les commandes.",
  "common.retry": "Réessayer",
  "orders.hub.pendingProposals": "{{count}} proposition(s) en attente",
  "orders.hub.viewProposals": "Voir →",
  "orders.hub.segments.action_required": "À agir",
  "orders.hub.segments.active": "En cours",
  "orders.hub.segments.disputed": "Problèmes",
  "orders.hub.segments.closed": "Terminées",
  "orders.hub.empty.action_required": "Aucune action requise pour le moment."
};

const mockRefetch = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const raw = mockTranslations[key] ?? key;
      if (!params) return raw;
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
        raw
      );
    }
  })
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() })
}));

jest.mock("../../../context/SessionContext", () => ({
  useSession: () => ({ accessToken: "tok", activeProfileId: "p1" })
}));

jest.mock("../../../hooks/useScrollBottomPad", () => ({
  useScrollBottomPad: () => 24
}));

jest.mock("../../../lib/buyerMarketplacePending", () => ({
  openBuyerOffersHub: jest.fn()
}));

jest.mock("../../../lib/producerMarketplacePending", () => ({
  openProducerOffersHub: jest.fn()
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: (opts: { queryKey: unknown[] }) => {
    const key = String(opts.queryKey[0]);
    if (key === "marketplace-orders-counters") {
      return {
        data: {
          actionRequired: 0,
          active: 0,
          disputed: 0,
          pendingProposals: 0
        },
        isFetching: false,
        refetch: mockRefetch
      };
    }
    if (key === "marketplace-orders") {
      return {
        data: undefined,
        isLoading: false,
        isFetching: false,
        error: new Error("Network request failed: ECONNREFUSED 127.0.0.1:3000"),
        refetch: mockRefetch
      };
    }
    return {
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: mockRefetch
    };
  }
}));

jest.mock("../OrderCard", () => ({
  OrderCard: () => null
}));

import { OrdersHubView } from "../OrdersHubView";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function flattenChildren(children: unknown): string {
  if (children == null) return "";
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(flattenChildren).join("");
  }
  return "";
}

describe("OrdersHubView — erreur réseau", () => {
  it("affiche un message i18n + Réessayer, jamais error.message brut", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        React.createElement(OrdersHubView, { role: "buyer" })
      );
    });
    const text = renderer.root
      .findAllByType(Text)
      .map((node) => flattenChildren(node.props.children))
      .join(" | ");
    expect(text).toContain("Impossible de charger les commandes.");
    expect(text).toContain("Réessayer");
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).not.toContain("Network request failed");
    act(() => {
      renderer.unmount();
    });
  });
});
