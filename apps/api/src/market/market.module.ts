import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PigPriceIndexCacheService } from "./pig-price-index-cache.service";
import { PigPriceIndexCronService } from "./pig-price-index-cron.service";
import { PigPriceIndexController } from "./pig-price-index.controller";
import { PigPriceIndexHybridService } from "./pig-price-index-hybrid.service";
import { PigPriceIndexService } from "./pig-price-index.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    FeatureFlagsModule,
    SmartAlertsModule,
    PushNotificationsModule
  ],
  controllers: [PigPriceIndexController],
  providers: [
    PigPriceIndexCacheService,
    PigPriceIndexHybridService,
    PigPriceIndexService,
    PigPriceIndexCronService
  ],
  exports: [PigPriceIndexService]
})
export class MarketModule {}
