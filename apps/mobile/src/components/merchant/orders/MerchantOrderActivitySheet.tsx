import { useTranslation } from "react-i18next";
import {
  OrderActivityFeed,
  type OrderActivityEvent as OrderActivityFeedEvent,
  type OrderPalette
} from "../../orders";
import { useOrderPalette } from "../../../hooks/useOrderPalette";
import {
  buildOrderActivityEvents,
  type OrderActivityEvent
} from "../../../lib/merchantOrderTracking";
import type { MerchantOrderDto } from "../../../lib/api";

type Props = {
  order: MerchantOrderDto;
  palette?: OrderPalette;
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

export function MerchantOrderActivitySheet({ order, palette }: Props) {
  const { t } = useTranslation();
  const rolePalette = useOrderPalette();
  const resolved = palette ?? rolePalette;
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
      palette={resolved}
    />
  );
}
