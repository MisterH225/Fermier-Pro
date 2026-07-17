import { useTranslation } from "react-i18next";
import {
  merchantOrderPalette,
  OrderActivityFeed,
  type OrderActivityEvent as OrderActivityFeedEvent
} from "../../orders";
import {
  buildOrderActivityEvents,
  type OrderActivityEvent
} from "../../../lib/merchantOrderTracking";
import type { MerchantOrderDto } from "../../../lib/api";

type Props = {
  order: MerchantOrderDto;
};

function activityMessage(
  t: (k: string, o?: Record<string, unknown>) => string,
  event: OrderActivityEvent
) {
  if (event.note?.trim()) return event.note.trim();
  const key = `merchant.orders.activity.${event.statusTo}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return t("merchant.orders.activity.generic", {
    status: t(`merchant.orders.status.${event.statusTo}`, {
      defaultValue: event.statusTo
    })
  });
}

export function MerchantOrderActivitySheet({ order }: Props) {
  const { t } = useTranslation();
  const events: OrderActivityFeedEvent[] = buildOrderActivityEvents(order).map(
    (event) => ({
      at: event.at,
      label: activityMessage(t, event),
      tone: "active"
    })
  );

  return (
    <OrderActivityFeed
      events={events}
      titleKey="merchant.orders.activity.title"
      emptyLabelKey="merchant.orders.activity.empty"
      palette={merchantOrderPalette}
    />
  );
}
