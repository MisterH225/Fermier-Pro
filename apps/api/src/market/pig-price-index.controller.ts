import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { PigPriceIndexService } from "./pig-price-index.service";

@Controller("market/pig-price-index")
@RequireFeature("marketplace")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard)
export class PigPriceIndexController {
  constructor(private readonly index: PigPriceIndexService) {}

  @Get()
  getIndex(
    @Query("period") period?: string,
    @Query("category") category?: string
  ) {
    return this.index.getChart(period, category);
  }

  @Get("today")
  getToday() {
    return this.index.getToday();
  }

  @Get("stats")
  getStats(@Query("period") period?: string) {
    return this.index.getStats(period);
  }

  @Get("ticker")
  getTicker() {
    return this.index.getTicker();
  }
}
