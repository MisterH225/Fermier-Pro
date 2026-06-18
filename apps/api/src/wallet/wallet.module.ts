import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DevMobileMoneyGateway } from "../marketplace/escrow/dev-mobile-money.gateway";
import { MOBILE_MONEY_GATEWAY } from "../marketplace/escrow/mobile-money.gateway";
import { PrismaModule } from "../prisma/prisma.module";
import { UserWalletService } from "./user-wallet.service";
import {
  LegacyBuyerWalletController,
  WalletController
} from "./wallet.controller";
import { WalletRailsService } from "./wallet-rails.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WalletController, LegacyBuyerWalletController],
  providers: [
    UserWalletService,
    WalletRailsService,
    DevMobileMoneyGateway,
    { provide: MOBILE_MONEY_GATEWAY, useExisting: DevMobileMoneyGateway }
  ],
  exports: [UserWalletService, WalletRailsService, MOBILE_MONEY_GATEWAY]
})
export class WalletModule {}

/** @deprecated Utiliser WalletModule */
export { WalletModule as BuyerWalletModule };
