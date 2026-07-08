import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChatModule } from "../chat/chat.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { MobileMoneyModule } from "../marketplace/escrow";
import { MarketplaceModule } from "../marketplace/marketplace.module";
import { PlatformSettingsModule } from "../platform-settings/platform-settings.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { WalletModule } from "../wallet/wallet.module";
import { MerchantCatalogController, MerchantShopController } from "./merchant-shop.controller";
import { MerchantCategoriesService } from "./merchant-categories.service";
import { MerchantDashboardService } from "./merchant-dashboard.service";
import { MerchantModerationService } from "./merchant-moderation.service";
import { MerchantOrdersService } from "./merchant-orders.service";
import { MerchantProductsService } from "./merchant-products.service";
import { MerchantProfilesService } from "./merchant-profiles.service";
import { MerchantShopsService } from "./merchant-shops.service";
import { MerchantSubscriptionBillingService } from "./merchant-subscription-billing.service";
import { MerchantSubscriptionPromoCodesService } from "./merchant-subscription-promo-codes.service";
import { MerchantSubscriptionCronService } from "./merchant-subscription.cron";
import { MerchantSubscriptionService } from "./merchant-subscription.service";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    WalletModule,
    forwardRef(() => MarketplaceModule),
    MobileMoneyModule,
    ConfigClientModule,
    FeatureFlagsModule,
    PlatformSettingsModule,
    PushNotificationsModule,
    ChatModule
  ],
  controllers: [MerchantShopController, MerchantCatalogController],
  providers: [
    MerchantProfilesService,
    MerchantShopsService,
    MerchantProductsService,
    MerchantCategoriesService,
    MerchantSubscriptionService,
    MerchantSubscriptionBillingService,
    MerchantSubscriptionPromoCodesService,
    MerchantSubscriptionCronService,
    MerchantOrdersService,
    MerchantModerationService,
    MerchantDashboardService
  ],
  exports: [
    MerchantProfilesService,
    MerchantProductsService,
    MerchantCategoriesService,
    MerchantModerationService,
    MerchantSubscriptionService,
    MerchantSubscriptionBillingService,
    MerchantSubscriptionPromoCodesService
  ]
})
export class MerchantShopModule {}
