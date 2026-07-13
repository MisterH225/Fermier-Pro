import { SetMetadata, UseInterceptors, applyDecorators } from "@nestjs/common";
import { IDEMPOTENT_META } from "./idempotency.constants";
import { IdempotencyInterceptor } from "./idempotency.interceptor";

/** Active la dédup via header `X-Idempotency-Key` sur un handler POST. */
export function Idempotent() {
  return applyDecorators(
    SetMetadata(IDEMPOTENT_META, true),
    UseInterceptors(IdempotencyInterceptor)
  );
}
