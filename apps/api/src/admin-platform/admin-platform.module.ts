import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AdminModerationModule } from "../admin-moderation/admin-moderation.module";
import { AuthModule } from "../auth/auth.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { VetsModule } from "../vets/vets.module";
import { AdminAiService } from "./admin-ai.service";
import { AdminConsoleAuthModule } from "./admin-console-auth.module";
import { AdminPlatformController } from "./admin-platform.controller";
import { AdminPlatformService } from "./admin-platform.service";
import { MarketModule } from "../market/market.module";
import { MarketplaceModule } from "../marketplace/marketplace.module";
import { VetAppointmentsModule } from "../vet-appointments/vet-appointments.module";
import { ProducerScoreModule } from "../producer-score/producer-score.module";
import { MerchantShopModule } from "../merchant-shop/merchant-shop.module";
import { MobileMoneyModule } from "../marketplace/escrow";
import { AdminMerchantSubscriptionsService } from "./admin-merchant-subscriptions.service";

@Module({
  imports: [
    AdminConsoleAuthModule,
    AuthModule,
    AdminModerationModule,
    VetsModule,
    PushNotificationsModule,
    AiModule,
    MarketModule,
    MarketplaceModule,
    MobileMoneyModule,
    VetAppointmentsModule,
    ProducerScoreModule,
    MerchantShopModule
  ],
  controllers: [AdminPlatformController],
  providers: [
    AdminPlatformService,
    AdminAiService,
    AdminMerchantSubscriptionsService
  ],
  exports: [AdminPlatformService, AdminConsoleAuthModule]
})
export class AdminPlatformModule {}