import { en } from "../../i18n/en";
import { fr } from "../../i18n/fr";

type Dict = Record<string, unknown>;

function getPath(obj: Dict, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Dict)) {
      return (acc as Dict)[key];
    }
    return undefined;
  }, obj);
}

describe("merchant / tracking order i18n coverage", () => {
  const required = [
    "merchant.orders.progress.received",
    "merchant.orders.progress.in_transit",
    "merchant.orders.progress.delivered",
    "merchant.orders.paymentMethods.wallet",
    "merchant.orders.paymentMethods.mobile_money",
    "ordersTracking.steps.received",
    "ordersTracking.steps.in_transit",
    "ordersTracking.steps.delivered",
    "marketScreen.transaction.paymentMethodCredit",
    "marketScreen.transaction.paymentMethodBalanceOrMobile",
    "marketScreen.transaction.paymentState.held",
    "marketScreen.transaction.status.OFFER_ACCEPTED",
    "marketScreen.transaction.status.OFFER_EXPIRED",
    "marketScreen.transaction.status.CANCELLED_SOLD_TO_OTHER"
  ];

  it.each(required)("définit %s en FR et EN", (path) => {
    expect(typeof getPath(fr as Dict, path)).toBe("string");
    expect(typeof getPath(en as Dict, path)).toBe("string");
  });
});
