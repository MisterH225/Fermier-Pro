import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { PenMoveDto } from "./dto/pen-move.dto";
import { HousingService } from "./housing.service";

@Controller("farms/:farmId")
@RequireFeature("housing")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard, FarmScopesGuard)
export class HousingMoveController {
  constructor(private readonly housing: HousingService) {}

  @Post("pen-move")
  @RequireFarmScopes(FARM_SCOPE.housingWrite)
  move(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: PenMoveDto
  ) {
    return this.housing.moveOccupant(user, farmId, dto);
  }
}
