import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { BuyerProposalsBreakdownCard } from "../BuyerProposalsBreakdownCard";
import { BuyerPurchasesPeriodCard } from "../BuyerPurchasesPeriodCard";
import { BuyerCreditDuesSection } from "../BuyerCreditDuesSection";

const mockNavigate = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}|${JSON.stringify(params)}` : key,
    i18n: { language: "fr" }
  })
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate })
}));

jest.mock("../../../lib/buyerMarketplacePending", () => ({
  openBuyerOffersHub: jest.fn()
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

function textOf(renderer: ReactTestRenderer): string {
  return collectStrings(renderer.toJSON()).join(" | ");
}

describe("Buyer dashboard cards", () => {
  it("affiche la répartition des propositions + empty soigné", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        React.createElement(BuyerProposalsBreakdownCard, {
          proposals: {
            pending: { count: 2, amount: 100000 },
            countered: { count: 1, amount: 50000 },
            accepted: { count: 0, amount: 0 },
            rejected: { count: 0, amount: 0 }
          }
        })
      );
    });
    const text = textOf(renderer);
    expect(text).toContain("buyer.dashboard.proposalStatus.pending");
    expect(text).toContain("buyer.dashboard.viewProposals");
    act(() => renderer.unmount());

    act(() => {
      renderer = create(
        React.createElement(BuyerProposalsBreakdownCard, {
          proposals: {
            pending: { count: 0, amount: 0 },
            countered: { count: 0, amount: 0 },
            accepted: { count: 0, amount: 0 },
            rejected: { count: 0, amount: 0 }
          }
        })
      );
    });
    expect(textOf(renderer)).toContain("buyer.dashboard.proposalsEmpty");
    act(() => renderer.unmount());
  });

  it("carte achats : totaux + pills de période", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        React.createElement(BuyerPurchasesPeriodCard, {
          purchases: {
            currency: "XOF",
            month: {
              total: 250000,
              previousTotal: 200000,
              count: 3,
              previousCount: 2,
              deltaPct: 25
            },
            quarter: {
              total: 600000,
              previousTotal: 500000,
              count: 8,
              previousCount: 7,
              deltaPct: 20
            },
            year: {
              total: 1200000,
              previousTotal: 900000,
              count: 20,
              previousCount: 15,
              deltaPct: 33.3
            }
          }
        })
      );
    });
    const text = textOf(renderer);
    expect(text).toContain("buyer.dashboard.purchasesTitle");
    expect(text).toContain("buyer.dashboard.periodMonth");
    expect(text).toMatch(/250/);
    act(() => renderer.unmount());
  });

  it("crédits absents si aucune dette ; badge retard sinon", () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        React.createElement(BuyerCreditDuesSection, {
          creditDues: { totalDue: 0, currency: "XOF", items: [] }
        })
      );
    });
    expect(renderer.toJSON()).toBeNull();
    act(() => renderer.unmount());

    act(() => {
      renderer = create(
        React.createElement(BuyerCreditDuesSection, {
          creditDues: {
            totalDue: 80000,
            currency: "XOF",
            items: [
              {
                offerId: "o1",
                transactionId: "tx1",
                sellerName: "Jean",
                farmName: "Ferme A",
                listingTitle: "Lot 10",
                amountDue: 80000,
                balanceDueAt: "2026-01-01T00:00:00.000Z",
                overdue: true,
                status: "balance_pending",
                currency: "XOF"
              }
            ]
          }
        })
      );
    });
    const text = textOf(renderer);
    expect(text).toContain("Ferme A");
    expect(text).toContain("buyer.dashboard.creditOverdue");
    act(() => renderer.unmount());
  });
});
