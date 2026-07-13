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
 * En production : fail-closed (throw). Hors production : log uniquement.
 */
@Injectable()
export class MobileMoneyGatewayGuard implements OnModuleInit {
  private readonly log = new Logger(MobileMoneyGatewayGuard.name);

  onModuleInit(): void {
    const provider = resolveMobileMoneyProvider();
    if (isDeploymentProduction() && provider === "dev") {
      throw new Error(
        "MOBILE_MONEY_PROVIDER=dev interdit en production — gateway simulé. " +
          "Branchez un provider réel (geniuspay, wave, orange, mtn…) avant les paiements réels."
      );
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
        const message = `MOBILE_MONEY_PROVIDER=geniuspay mais variables manquantes: ${missing.join(", ")}`;
        if (isDeploymentProduction()) {
          throw new Error(message);
        }
        this.log.error(message);
        return;
      }

      const apiKey = process.env.GENIUSPAY_API_KEY?.trim() ?? "";
      if (apiKey && !/^pk_/i.test(apiKey)) {
        const message =
          "GENIUSPAY_API_KEY doit être la clé publique pk_sandbox_/pk_live_ " +
          "(pas sk_). Voir .env.example et la doc GeniusPay.";
        if (isDeploymentProduction()) {
          throw new Error(message);
        }
        this.log.error(message);
      }
      const webhookSecret = process.env.GENIUSPAY_WEBHOOK_SECRET?.trim() ?? "";
      if (!/^whsec_/i.test(webhookSecret)) {
        const message =
          "GENIUSPAY_WEBHOOK_SECRET doit commencer par whsec_ " +
          "(secret affiché à la création du webhook GeniusPay, pas GENIUSPAY_API_SECRET sk_).";
        if (isDeploymentProduction()) {
          throw new Error(message);
        }
        this.log.error(message);
      }
      this.log.log("Gateway mobile money GeniusPay actif");
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
