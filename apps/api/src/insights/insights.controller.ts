import {
  Controller,
  Get,
  HttpCode,
  Param,
  Query,
  Res,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { InsightsService } from "./insights.service";

@Controller("farms/:farmId/insights")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get("after-weighing")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  async afterWeighing(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("animalId") animalId: string | undefined,
    @Query("batchId") batchId: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    const insight = await this.insights.afterWeighing(user, farmId, {
      animalId: animalId?.trim() || undefined,
      batchId: batchId?.trim() || undefined
    });
    if (!insight) {
      res.status(204);
      return;
    }
    return insight;
  }

  @Get("after-sale")
  @HttpCode(200)
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  async afterSale(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("exitId") exitId: string,
    @Res({ passthrough: true }) res: Response
  ) {
    if (!exitId?.trim()) {
      res.status(204);
      return;
    }
    const insight = await this.insights.afterSale(
      user,
      farmId,
      exitId.trim()
    );
    if (!insight) {
      res.status(204);
      return;
    }
    return insight;
  }

  @Get("after-farrowing")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  async afterFarrowing(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("litterId") litterId: string,
    @Res({ passthrough: true }) res: Response
  ) {
    if (!litterId?.trim()) {
      res.status(204);
      return;
    }
    const insight = await this.insights.afterFarrowing(
      user,
      farmId,
      litterId.trim()
    );
    if (!insight) {
      res.status(204);
      return;
    }
    return insight;
  }
}
