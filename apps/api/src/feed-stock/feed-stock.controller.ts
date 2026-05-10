import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { ConsumeFeedStockDto } from "./dto/consume-feed-stock.dto";
import { CreateFeedStockLotDto } from "./dto/create-feed-stock-lot.dto";
import { FeedStockService } from "./feed-stock.service";

@Controller("farms/:farmId/feed-stock-lots")
@RequireFeature("feedStock")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard, FarmScopesGuard)
export class FeedStockController {
  constructor(private readonly feedStock: FeedStockService) {}

  @Get()
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  list(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.feedStock.list(user, farmId);
  }

  @Post()
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  create(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateFeedStockLotDto
  ) {
    return this.feedStock.create(user, farmId, dto);
  }

  @Patch(":lotId/consume")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  consume(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("lotId") lotId: string,
    @Body() dto: ConsumeFeedStockDto
  ) {
    return this.feedStock.consume(user, farmId, lotId, dto);
  }
}
