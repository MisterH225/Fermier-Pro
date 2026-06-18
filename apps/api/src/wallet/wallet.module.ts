import { Module, forwardRef } from "@nestjs/common";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { AuthModule } from "../auth/auth.module";
import { MobileMoneyModule } from "../marketplace/escrow/mobile-money.module";
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

/**
 * Portefeuille universel (recharge, retrait, transfert) + orchestrateur de paiement.
 *
 * Cycle d'import : AuthModule → FarmDataPurgeModule → MarketplaceModule → WalletModule
 *                                                                       ↘ AuthModule
 * `forwardRef(() => AuthModule)` suffit car TypeScript compile les imports en accès
 * de propriété paresseux (`auth_module_1.AuthModule`) — la classe est résolue au
 * moment où Nest scanne les dépendances, pas à l'évaluation du décorateur.
 */
@Module({
  imports: [PrismaModule, MobileMoneyModule, forwardRef(() => AuthModule)],
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
    SuperAdminGuard
  ],
  exports: [
    UserWalletService,
    WalletRailsService,
    WalletFeeService,
    PlatformAccountService,
    MobileMoneyModule
  ]
})
export class WalletModule {}
