import { Ionicons } from "@expo/vector-icons";
import {
  merchantOrderPalette,
  OrderTrackingStepper,
  type OrderTrackingStep
} from "../../orders";
import type { MerchantOrderDto } from "../../../lib/api";
import {
  ORDER_PROGRESS_STEPS,
  type OrderProgressStepKey
} from "../../../lib/merchantOrderTracking";

const STEP_ICON: Record<OrderProgressStepKey, keyof typeof Ionicons.glyphMap> = {
  received: "cube",
  in_transit: "bicycle",
  delivered: "checkmark"
};

function stampForStep(order: MerchantOrderDto, key: OrderProgressStepKey) {
  if (key === "received") return order.paidAt ?? order.confirmedAt;
  if (key === "in_transit") return order.shippedAt;
  return order.deliveredAt ?? order.completedAt;
}

type Props = {
  order: MerchantOrderDto;
};

export function MerchantOrderProgressStepper({ order }: Props) {
  const steps: OrderTrackingStep[] = ORDER_PROGRESS_STEPS.map((step) => ({
    key: step.key,
    labelKey: `merchant.orders.progress.${step.key}`,
    icon: STEP_ICON[step.key],
    timestamp: stampForStep(order, step.key)
  }));
  const activeIndex =
    order.status === "shipping" || order.status === "disputed"
      ? 1
      : order.status === "delivered" || order.status === "completed"
        ? 2
        : ["rejected", "auto_rejected", "refunded", "failed", "cancelled"].includes(
              order.status
            )
          ? -1
          : 0;
  const completedThroughIndex =
    activeIndex >= 0 ? activeIndex - 1 : order.status === "failed" ? -1 : 0;

  return (
    <OrderTrackingStepper
      steps={steps}
      activeIndex={activeIndex}
      completedThroughIndex={completedThroughIndex}
      completedIcon="step"
      palette={merchantOrderPalette}
    />
  );
}
