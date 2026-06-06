import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChatModule } from "../chat/chat.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { FarmRatingsController } from "./farm-ratings.controller";
import { FarmRatingsService } from "./farm-ratings.service";
import { FarmMarketplaceLifecycleService } from "./farm-marketplace-lifecycle.service";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";
import { MarketplaceCronService } from "./marketplace-cron.service";
import { MarketplacePigPriceIndexController } from "./pig-price-index.controller";
import { MarketplacePigPriceIndexCronService } from "./pig-price-index.cron";
import { MarketplacePigPriceIndexService } from "./pig-price-index.service";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";

@Module({
  imports: [
    AuthModule,
    ChatModule,
    ConfigClientModule,
    FeatureFlagsModule,
    PushNotificationsModule
  ],
  controllers: [
    ListingsController,
    OffersController,
    FarmRatingsController,
    MarketplacePigPriceIndexController
  ],
  providers: [
    FarmMarketplaceLifecycleService,
    ListingsService,
    OffersService,
    FarmRatingsService,
    MarketplaceCronService,
    MarketplacePigPriceIndexService,
    MarketplacePigPriceIndexCronService
  ],
  exports: [
    FarmMarketplaceLifecycleService,
    ListingsService,
    MarketplacePigPriceIndexService
  ]
})
export class MarketplaceModule {}
