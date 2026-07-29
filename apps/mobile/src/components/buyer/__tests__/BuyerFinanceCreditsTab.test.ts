import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { BuyerFinanceCreditsTab } from "../BuyerFinanceCreditsTab";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}|${JSON.stringify(params)}` : key,
    i18n: { language: "fr" }
  })
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() })
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function collectStrings(node: unknown, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectStrings(child, out);
    return out;
  }
  if (typeof node === "object") {
    const n = node as { children?: unknown; props?: { children?: unknown } };
    if (n.children != null) collectStrings(n.children, out);
    else if (n.props?.children != null) collectStrings(n.props.children, out);
  }
  return out;
}

describe("BuyerFinanceCreditsTab", () => {
  it("affiche un empty soigné sans crédits", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        React.createElement(BuyerFinanceCreditsTab, {
          data: { totalDue: 0, currency: "XOF", open: { totalDue: 0, currency: "XOF", items: [] }, items: [] },
          isLoading: false
        })
      );
    });
    const text = collectStrings(renderer.toJSON()).join(" | ");
    expect(text).toContain("buyer.finance.creditsEmpty");
    act(() => renderer.unmount());
  });

  it("affiche badge retard et montants", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        React.createElement(BuyerFinanceCreditsTab, {
          isLoading: false,
          data: {
            totalDue: 80_000,
            currency: "XOF",
            open: {
              totalDue: 80_000,
              currency: "XOF",
              items: []
            },
            items: [
              {
                offerId: "o1",
                transactionId: "tx1",
                sellerName: "Jean",
                farmName: "Ferme A",
                listingTitle: "Lot",
                initialAmount: 200_000,
                advanceAmount: 120_000,
                amountDue: 80_000,
                balanceDueAt: "2026-01-01T00:00:00.000Z",
                overdue: true,
                financeStatus: "overdue",
                status: "balance_pending",
                currency: "XOF"
              }
            ]
          }
        })
      );
    });
    const text = collectStrings(renderer.toJSON()).join(" | ");
    expect(text).toContain("Ferme A");
    expect(text).toContain("buyer.finance.creditStatus.overdue");
    act(() => renderer.unmount());
  });
});
