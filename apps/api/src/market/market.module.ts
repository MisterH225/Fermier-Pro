import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PigPriceIndexCacheService } from "./pig-price-index-cache.service";
import { PigPriceIndexCronService } from "./pig-price-index-cron.service";
import { PigPriceIndexController } from "./pig-price-index.controller";
import { PigPriceIndexService } from "./pig-price-index.service";

@Module({
  imports: [PrismaModule, AuthModule, ConfigClientModule, SmartAlertsModule],
  controllers: [PigPriceIndexController],
  providers: [
    PigPriceIndexCacheService,
    PigPriceIndexService,
    PigPriceIndexCronService
  ],
  exports: [PigPriceIndexService]
})
export class MarketModule {}
