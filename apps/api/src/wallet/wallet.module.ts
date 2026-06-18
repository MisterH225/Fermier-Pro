import { Module, forwardRef } from "@nestjs/common";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { DevMobileMoneyGateway } from "../marketplace/escrow/dev-mobile-money.gateway";
import { MOBILE_MONEY_GATEWAY } from "../marketplace/escrow/mobile-money.gateway";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminWalletController } from "./admin-wallet.controller";
import { PlatformAccountService } from "./platform-account.service";
import { UserWalletService } from "./user-wallet.service";
import {
  LegacyBuyerWalletController,
  WalletController
} from "./wallet.controller";
import { WalletFeeService } from "./wallet-fee.service";
import { WalletRailsService } from "./wallet-rails.service";
import { WithdrawalOrchestratorService } from "./withdrawal-orchestrator.service";

@Module({
  imports: [
    PrismaModule,
    // require() évite le cycle JS auth → purge → marketplace → wallet → auth
    forwardRef(() => require("../auth/auth.module").AuthModule)
  ],
  controllers: [
    WalletController,
    LegacyBuyerWalletController,
    AdminWalletController
  ],
  providers: [
    UserWalletService,
    WalletFeeService,
    PlatformAccountService,
    WithdrawalOrchestratorService,
    WalletRailsService,
    DevMobileMoneyGateway,
    SuperAdminGuard,
    { provide: MOBILE_MONEY_GATEWAY, useExisting: DevMobileMoneyGateway }
  ],
  exports: [
    UserWalletService,
    WalletRailsService,
    WalletFeeService,
    PlatformAccountService,
    MOBILE_MONEY_GATEWAY
  ]
})
export class WalletModule {}

/** @deprecated Utiliser WalletModule */
export { WalletModule as BuyerWalletModule };
