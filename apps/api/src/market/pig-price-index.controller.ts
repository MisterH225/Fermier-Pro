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
import { MarketplacePigPriceIndexService } from "../marketplace/pig-price-index.service";
import { PigPriceIndexService } from "./pig-price-index.service";

@Controller("market/pig-price-index")
@RequirePlatformModule("pig_price_index")
@UseGuards(SupabaseJwtGuard, PlatformModuleEnabledGuard)
export class PigPriceIndexController {
  constructor(
    private readonly index: PigPriceIndexService,
    private readonly hybridIndex: MarketplacePigPriceIndexService
  ) {}

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

  /** Indice hybride anti-manipulation (canonique sous /market). */
  @Get("hybrid")
  async getHybrid() {
    const data = await this.hybridIndex.getPublicIndex();
    if (!data) {
      return {
        price_per_kg: null,
        trend: "stable" as const,
        variation_7d_pct: null,
        calculated_at: null,
        data_points_count: 0
      };
    }
    return data;
  }

  /** Agrégat marketplace : indice hybride + ticker + graphique + stats (1 requête). */
  @Get("dashboard")
  async getDashboard(
    @Query("period") period?: string,
    @Query("category") category?: string
  ) {
    const [hybrid, ticker, chart, stats] = await Promise.all([
      this.getHybrid(),
      this.index.getTicker(),
      this.index.getChart(period, category),
      this.index.getStats(period)
    ]);
    return { hybrid, ticker, chart, stats };
  }
}
