import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { RequirePlatformModule } from "../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../feature-flags/platform-module-enabled.guard";
import { MarketplacePigPriceIndexService } from "./pig-price-index.service";

@Controller("marketplace/pig-price-index")
@RequirePlatformModule("pig_price_index")
@UseGuards(SupabaseJwtGuard, PlatformModuleEnabledGuard)
export class MarketplacePigPriceIndexController {
  constructor(private readonly index: MarketplacePigPriceIndexService) {}

  @Get()
  async getIndex() {
    const data = await this.index.getPublicIndex();
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
}
