import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { setDeprecatedSuccessor } from "../common/http/deprecation.util";
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
  async getIndex(@Res({ passthrough: true }) res: Response) {
    setDeprecatedSuccessor(res, "/api/v1/market/pig-price-index/hybrid");
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
