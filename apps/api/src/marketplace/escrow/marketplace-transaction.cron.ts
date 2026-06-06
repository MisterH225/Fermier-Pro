import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MarketplaceTransactionService } from "./marketplace-transaction.service";

@Injectable()
export class MarketplaceTransactionCronService {
  private readonly log = new Logger(MarketplaceTransactionCronService.name);

  constructor(private readonly transactions: MarketplaceTransactionService) {}

  /** Paiements expirés (48 h) + auto-validation poids (24 h). */
  @Cron("0 * * * *")
  async hourlyEscrowMaintenance(): Promise<void> {
    try {
      const expired = await this.transactions.handleExpiredPayments();
      const validated = await this.transactions.handleAutoValidateWeights();
      if (expired > 0 || validated > 0) {
        this.log.log(
          `Escrow cron: ${expired} paiement(s) expiré(s), ${validated} poids auto-validé(s)`
        );
      }
    } catch (e) {
      this.log.warn(`escrow cron: ${(e as Error).message}`);
    }
  }
}
