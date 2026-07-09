import { resolveInvoiceSyncInsight } from "./admin-merchant-subscription-invoices.util";

describe("resolveInvoiceSyncInsight", () => {
  it("détecte paiement GeniusPay complété mais facture pending", () => {
    expect(
      resolveInvoiceSyncInsight({
        invoiceStatus: "pending",
        providerRef: "GP-123",
        lookupFound: true,
        providerStatus: "completed",
        providerAmount: 2500,
        invoiceAmount: 2500
      })
    ).toBe("provider_completed_invoice_pending");
  });

  it("détecte alignement facture payée et GeniusPay completed", () => {
    expect(
      resolveInvoiceSyncInsight({
        invoiceStatus: "paid",
        providerRef: "GP-123",
        lookupFound: true,
        providerStatus: "completed",
        providerAmount: 5000,
        invoiceAmount: 5000
      })
    ).toBe("aligned_completed");
  });

  it("signale référence portefeuille interne", () => {
    expect(
      resolveInvoiceSyncInsight({
        invoiceStatus: "paid",
        providerRef: "merchant-premium:user-1",
        lookupFound: false,
        invoiceAmount: 5000
      })
    ).toBe("internal_wallet_ref");
  });
});
