import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChatModule } from "../chat/chat.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import {
  DevMobileMoneyGateway,
  EscrowService,
  MarketplaceTransactionController,
  MarketplaceTransactionCronService,
  MarketplaceTransactionService,
  MobileMoneyWebhookController,
  mobileMoneyGatewayGuardProvider,
  mobileMoneyGatewayProvider
} from "./escrow";
import { ReceiptController, ReceiptCronService, ReceiptPdfService, ReceiptService, ReceiptVerifyController } from "./receipts";
import { FarmRatingsController } from "./farm-ratings.controller";
import { FarmRatingsService } from "./farm-ratings.service";
import { FarmMarketplaceLifecycleService } from "./farm-marketplace-lifecycle.service";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";
import { MarketplaceCronService } from "./marketplace-cron.service";
import { MarketplacePigPriceIndexController } from "./pig-price-index.controller";
import { MarketplacePigPriceIndexCronService } from "./pig-price-index.cron";
import { MarketplacePigPriceIndexService } from "./pig-price-index.service";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { BuyerProfileDetectorService } from "./buyer-profile-detector.service";
import { CreditCronService } from "./credit/credit-cron.service";
import { CreditOffersController } from "./credit/credit-offers.controller";
import { CreditOffersService } from "./credit/credit-offers.service";
import { CreditScoreService } from "./credit/credit-score.service";
import { MarketplaceDisputesController } from "./marketplace-disputes.controller";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";

@Module({
  imports: [
    forwardRef(() => AuthModule),
    ChatModule,
    ConfigClientModule,
    FeatureFlagsModule,
    PushNotificationsModule
  ],
  controllers: [
    ListingsController,
    OffersController,
    FarmRatingsController,
    MarketplacePigPriceIndexController,
    MarketplaceTransactionController,
    MarketplaceDisputesController,
    CreditOffersController,
    MobileMoneyWebhookController,
    ReceiptController,
    ReceiptVerifyController
  ],
  providers: [
    SuperAdminGuard,
    FarmMarketplaceLifecycleService,
    ListingsService,
    OffersService,
    FarmRatingsService,
    MarketplaceCronService,
    MarketplacePigPriceIndexService,
    MarketplacePigPriceIndexCronService,
    EscrowService,
    MarketplaceTransactionService,
    MarketplaceTransactionCronService,
    DevMobileMoneyGateway,
    mobileMoneyGatewayGuardProvider,
    mobileMoneyGatewayProvider,
    ReceiptService,
    ReceiptPdfService,
    ReceiptCronService,
    BuyerProfileDetectorService,
    CreditScoreService,
    CreditOffersService,
    CreditCronService
  ],
  exports: [
    FarmMarketplaceLifecycleService,
    ListingsService,
    MarketplacePigPriceIndexService,
    MarketplaceTransactionService,
    ReceiptService,
    CreditOffersService,
    CreditScoreService
  ]
})
export class MarketplaceModule {}
