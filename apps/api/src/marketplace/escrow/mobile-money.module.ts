import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { DevMobileMoneyGateway } from "./dev-mobile-money.gateway";
import { GeniusPayClient } from "./geniuspay/geniuspay.client";
import { GeniusPayMobileMoneyGateway } from "./geniuspay/geniuspay-mobile-money.gateway";
import { MOBILE_MONEY_GATEWAY } from "./mobile-money.gateway";
import {
  mobileMoneyGatewayGuardProvider,
  mobileMoneyGatewayProvider
} from "./mobile-money-gateway.provider";

/**
 * Source unique du gateway Mobile Money pour toute l'application.
 *
 * - `DevMobileMoneyGateway` est un singleton (état en mémoire pour les paiements simulés).
 *   Tout module qui a besoin du gateway doit importer ce module — ne **jamais**
 *   le redéclarer comme provider ailleurs (double instance = état dédoublé).
 * - Le binding `MOBILE_MONEY_GATEWAY` permet d'injecter via `@Inject(MOBILE_MONEY_GATEWAY)`
 *   pour brancher un provider réel sans modifier les consommateurs.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    DevMobileMoneyGateway,
    GeniusPayClient,
    GeniusPayMobileMoneyGateway,
    mobileMoneyGatewayProvider,
    mobileMoneyGatewayGuardProvider
  ],
  exports: [
    DevMobileMoneyGateway,
    GeniusPayClient,
    GeniusPayMobileMoneyGateway,
    MOBILE_MONEY_GATEWAY
  ]
})
export class MobileMoneyModule {}
