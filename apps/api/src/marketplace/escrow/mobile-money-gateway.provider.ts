import {
  Injectable,
  Logger,
  type FactoryProvider,
  type OnModuleInit
} from "@nestjs/common";
import { DevMobileMoneyGateway } from "./dev-mobile-money.gateway";
import { MOBILE_MONEY_GATEWAY } from "./mobile-money.gateway";
import { isDeploymentProduction } from "./runtime-env.util";

/**
 * Refuse le gateway simulé en production tant qu'aucun provider réel n'est branché.
 */
@Injectable()
class MobileMoneyGatewayGuard implements OnModuleInit {
  private readonly log = new Logger(MobileMoneyGatewayGuard.name);

  onModuleInit(): void {
    const provider = (process.env.MOBILE_MONEY_PROVIDER ?? "dev").trim().toLowerCase();
    if (isDeploymentProduction() && provider === "dev") {
      this.log.error(
        "MOBILE_MONEY_PROVIDER=dev avec APP_ENV production — gateway simulé actif. " +
          "Branchez un provider réel (wave, orange, mtn…) avant les paiements réels."
      );
      return;
    }
    if (provider === "dev") {
      this.log.warn(
        "Gateway mobile money DEV actif — ne pas utiliser pour de vrais fonds."
      );
    }
  }
}

export const mobileMoneyGatewayProvider: FactoryProvider = {
  provide: MOBILE_MONEY_GATEWAY,
  useFactory: (dev: DevMobileMoneyGateway) => dev,
  inject: [DevMobileMoneyGateway]
};

export const mobileMoneyGatewayGuardProvider = MobileMoneyGatewayGuard;
