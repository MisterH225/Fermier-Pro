import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { DistributedLockService } from "./distributed-lock.service";
import { FarmAccessService } from "./farm-access.service";
import { FarmScopesGuard } from "./guards/farm-scopes.guard";
import { IdempotencyInterceptor } from "./idempotency/idempotency.interceptor";
import { IdempotencyService } from "./idempotency/idempotency.service";

@Global()
@Module({
  providers: [
    FarmAccessService,
    FarmScopesGuard,
    AuditService,
    DistributedLockService,
    IdempotencyService,
    IdempotencyInterceptor
  ],
  exports: [
    FarmAccessService,
    FarmScopesGuard,
    AuditService,
    DistributedLockService,
    IdempotencyService,
    IdempotencyInterceptor
  ]
})
export class CommonModule {}
