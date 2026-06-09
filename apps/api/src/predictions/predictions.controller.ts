import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { RequirePlatformModule } from "../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../feature-flags/platform-module-enabled.guard";
import { PredictionsService } from "./predictions.service";

@Controller("farms/:farmId/predictions")
@RequirePlatformModule("ai_assistant")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard, PlatformModuleEnabledGuard)
export class PredictionsController {
  constructor(private readonly predictions: PredictionsService) {}

  @Post("generate")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  generate(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.predictions.generatePredictions(user, farmId);
  }

  @Get()
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  getAll(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.predictions.getPredictions(user, farmId);
  }

  @Get("cheptel")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  cheptel(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.predictions.getMenuPredictions(user, farmId, "cheptel");
  }

  @Get("finance")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  finance(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.predictions.getMenuPredictions(user, farmId, "finance");
  }

  @Get("stock")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  stock(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.predictions.getMenuPredictions(user, farmId, "stock");
  }

  @Get("gestation")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  gestation(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.predictions.getMenuPredictions(user, farmId, "gestation");
  }

  @Get("summary")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  summary(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.predictions.getMenuPredictions(user, farmId, "summary");
  }
}
