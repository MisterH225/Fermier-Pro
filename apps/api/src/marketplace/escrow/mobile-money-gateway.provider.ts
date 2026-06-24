import {
  Injectable,
  Logger,
  type FactoryProvider,
  type OnModuleInit
} from "@nestjs/common";
import { DevMobileMoneyGateway } from "./dev-mobile-money.gateway";
import { GeniusPayMobileMoneyGateway } from "./geniuspay/geniuspay-mobile-money.gateway";
import { MOBILE_MONEY_GATEWAY } from "./mobile-money.gateway";
import { isDeploymentProduction } from "./runtime-env.util";

function resolveMobileMoneyProvider(): string {
  return (process.env.MOBILE_MONEY_PROVIDER ?? "dev").trim().toLowerCase();
}

/**
 * Refuse le gateway simulé en production tant qu'aucun provider réel n'est branché.
 */
@Injectable()
class MobileMoneyGatewayGuard implements OnModuleInit {
  private readonly log = new Logger(MobileMoneyGatewayGuard.name);

  onModuleInit(): void {
    const provider = resolveMobileMoneyProvider();
    if (isDeploymentProduction() && provider === "dev") {
      this.log.error(
        "MOBILE_MONEY_PROVIDER=dev avec APP_ENV production — gateway simulé actif. " +
          "Branchez un provider réel (geniuspay, wave, orange, mtn…) avant les paiements réels."
      );
      return;
    }
    if (provider === "dev") {
      this.log.warn(
        "Gateway mobile money DEV actif — ne pas utiliser pour de vrais fonds."
      );
      return;
    }
    if (provider === "geniuspay") {
      const missing = [
        "GENIUSPAY_API_KEY",
        "GENIUSPAY_API_SECRET",
        "GENIUSPAY_WEBHOOK_SECRET"
      ].filter((key) => !process.env[key]?.trim());
      if (missing.length > 0) {
        this.log.error(
          `MOBILE_MONEY_PROVIDER=geniuspay mais variables manquantes: ${missing.join(", ")}`
        );
      } else {
        this.log.log("Gateway mobile money GeniusPay actif");
      }
    }
  }
}

export const mobileMoneyGatewayProvider: FactoryProvider = {
  provide: MOBILE_MONEY_GATEWAY,
  useFactory: (
    dev: DevMobileMoneyGateway,
    geniuspay: GeniusPayMobileMoneyGateway
  ) => {
    const provider = resolveMobileMoneyProvider();
    if (provider === "geniuspay") {
      return geniuspay;
    }
    return dev;
  },
  inject: [DevMobileMoneyGateway, GeniusPayMobileMoneyGateway]
};

export const mobileMoneyGatewayGuardProvider = MobileMoneyGatewayGuard;
