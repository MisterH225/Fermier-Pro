import {
  Body,
  Controller,
  Param,
  Patch,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { RequirePlatformModule } from "../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../feature-flags/platform-module-enabled.guard";
import { ResolveDeliveryDisputeDto } from "./dto/resolve-delivery-dispute.dto";
import { MarketplaceTransactionService } from "./escrow/marketplace-transaction.service";

@Controller("marketplace/disputes")
@RequirePlatformModule("marketplace")
@UseGuards(SupabaseJwtGuard, PlatformModuleEnabledGuard, SuperAdminGuard)
export class MarketplaceDisputesController {
  constructor(private readonly transactions: MarketplaceTransactionService) {}

  @Patch(":id/resolve")
  resolveDeliveryDispute(
    @CurrentUser() admin: User,
    @Param("id") id: string,
    @Body() body: ResolveDeliveryDisputeDto
  ) {
    return this.transactions.resolveDeliveryDispute(admin.id, id, body);
  }
}
