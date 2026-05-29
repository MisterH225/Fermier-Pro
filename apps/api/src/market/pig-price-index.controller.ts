import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { RequirePlatformModule } from "../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../feature-flags/platform-module-enabled.guard";
import { PigPriceIndexService } from "./pig-price-index.service";

@Controller("market/pig-price-index")
@RequirePlatformModule("pig_price_index")
@UseGuards(SupabaseJwtGuard, PlatformModuleEnabledGuard)
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
