import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { DistributedLockService } from "./distributed-lock.service";
import { FarmAccessService } from "./farm-access.service";
import { FarmScopesGuard } from "./guards/farm-scopes.guard";

@Global()
@Module({
  providers: [FarmAccessService, FarmScopesGuard, AuditService, DistributedLockService],
  exports: [FarmAccessService, FarmScopesGuard, AuditService, DistributedLockService]
})
export class CommonModule {}
