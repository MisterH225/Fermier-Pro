import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChatModule } from "../chat/chat.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { FarmRatingsController } from "./farm-ratings.controller";
import { FarmRatingsService } from "./farm-ratings.service";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";
import { MarketplaceCronService } from "./marketplace-cron.service";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";

@Module({
  imports: [AuthModule, ChatModule, ConfigClientModule, PushNotificationsModule],
  controllers: [ListingsController, OffersController, FarmRatingsController],
  providers: [
    ListingsService,
    OffersService,
    FarmRatingsService,
    MarketplaceCronService
  ]
})
export class MarketplaceModule {}
