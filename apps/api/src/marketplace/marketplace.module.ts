import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChatModule } from "../chat/chat.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { MarketModule } from "../market/market.module";
import { MerchantShopModule } from "../merchant-shop/merchant-shop.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { UserNotificationsModule } from "../user-notifications/user-notifications.module";
import {
  EscrowService,
  MarketplaceTransactionController,
  MarketplaceTransactionCronService,
  MarketplaceTransactionService,
  MobileMoneyModule
} from "./escrow";
import { GeniusPayWebhookController } from "./escrow/geniuspay/geniuspay-webhook.controller";
import { ReceiptController, ReceiptCronService, ReceiptPdfService, ReceiptService, ReceiptVerifyController } from "./receipts";
import { FarmRatingsController } from "./farm-ratings.controller";
import { FarmRatingsService } from "./farm-ratings.service";
import { FarmMarketplaceLifecycleService } from "./farm-marketplace-lifecycle.service";
import { HealthBadgeExpiryCronService } from "./health-badge-expiry.cron";
import { HealthBadgeExpiryService } from "./health-badge-expiry.service";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";
import { MarketplaceCronService } from "./marketplace-cron.service";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { BuyerProfileDetectorService } from "./buyer-profile-detector.service";
import { CreditCronService } from "./credit/credit-cron.service";
import { CreditOffersController } from "./credit/credit-offers.controller";
import { CreditOffersService } from "./credit/credit-offers.service";
import { CreditScoreService } from "./credit/credit-score.service";
import { MarketplaceDisputesController } from "./marketplace-disputes.controller";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";
import { ProducerScoreModule } from "../producer-score/producer-score.module";
import { ProducerSubscriptionModule } from "../producer-subscription/producer-subscription.module";
import { WalletModule } from "../wallet/wallet.module";
import { ListingAnimalSyncService } from "./listing-animal-sync.service";
import { OrdersController, OrdersProjectionService } from "./orders";

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => WalletModule),
    forwardRef(() => MarketModule),
    forwardRef(() => MerchantShopModule),
    MobileMoneyModule,
    ChatModule,
    ConfigClientModule,
    FeatureFlagsModule,
    PushNotificationsModule,
    UserNotificationsModule,
    ProducerScoreModule,
    ProducerSubscriptionModule
  ],
  controllers: [
    ListingsController,
    OffersController,
    FarmRatingsController,
    MarketplaceTransactionController,
    MarketplaceDisputesController,
    CreditOffersController,
    GeniusPayWebhookController,
    ReceiptController,
    ReceiptVerifyController,
    OrdersController
  ],
  providers: [
    SuperAdminGuard,
    FarmMarketplaceLifecycleService,
    ListingsService,
    ListingAnimalSyncService,
    OffersService,
    FarmRatingsService,
    MarketplaceCronService,
    HealthBadgeExpiryService,
    HealthBadgeExpiryCronService,
    EscrowService,
    MarketplaceTransactionService,
    MarketplaceTransactionCronService,
    ReceiptService,
    ReceiptPdfService,
    ReceiptCronService,
    BuyerProfileDetectorService,
    CreditScoreService,
    CreditOffersService,
    CreditCronService,
    OrdersProjectionService
  ],
  exports: [
    FarmMarketplaceLifecycleService,
    ListingsService,
    ListingAnimalSyncService,
    MarketplaceTransactionService,
    ReceiptService,
    CreditOffersService,
    CreditScoreService,
    EscrowService,
    OrdersProjectionService
  ]
})
export class MarketplaceModule {}
