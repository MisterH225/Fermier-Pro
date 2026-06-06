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
import { ReceiptController, ReceiptPdfService, ReceiptService } from "./receipts";
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
    MarketplacePigPriceIndexController,
    MarketplaceTransactionController,
    MobileMoneyWebhookController,
    ReceiptController
  ],
  providers: [
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
    ReceiptPdfService
  ],
  exports: [
    FarmMarketplaceLifecycleService,
    ListingsService,
    MarketplacePigPriceIndexService,
    MarketplaceTransactionService,
    ReceiptService
  ]
})
export class MarketplaceModule {}
