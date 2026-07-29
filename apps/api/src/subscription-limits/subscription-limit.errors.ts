import { ForbiddenException } from "@nestjs/common";

export const SUBSCRIPTION_LIMIT_ERROR = {
  FARM_LIMIT_REACHED: "FARM_LIMIT_REACHED",
  SHOP_LIMIT_REACHED: "SHOP_LIMIT_REACHED",
  PRODUCT_LIMIT_REACHED: "PRODUCT_LIMIT_REACHED"
} as const;

export type SubscriptionLimitErrorCode =
  (typeof SUBSCRIPTION_LIMIT_ERROR)[keyof typeof SUBSCRIPTION_LIMIT_ERROR];

export function forbiddenLimit(
  code: SubscriptionLimitErrorCode,
  message: string
): ForbiddenException {
  return new ForbiddenException({
    statusCode: 403,
    code,
    message
  });
}
