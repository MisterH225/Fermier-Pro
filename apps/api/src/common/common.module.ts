import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { FarmAccessService } from "./farm-access.service";
import { FarmScopesGuard } from "./guards/farm-scopes.guard";

@Global()
@Module({
  providers: [FarmAccessService, FarmScopesGuard, AuditService],
  exports: [FarmAccessService, FarmScopesGuard, AuditService]
})
export class CommonModule {}
