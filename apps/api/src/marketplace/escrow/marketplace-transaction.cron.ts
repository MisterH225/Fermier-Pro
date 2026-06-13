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
      const reminders = await this.transactions.handleDeliveryReminders();
      const autoDisputes = await this.transactions.handleAutoDeliveryDisputes();
      if (
        expired > 0 ||
        validated > 0 ||
        reminders.vendor > 0 ||
        reminders.buyer > 0 ||
        autoDisputes > 0
      ) {
        this.log.log(
          `Escrow cron: ${expired} expiré(s), ${validated} poids auto-validé(s), rappels V${reminders.vendor}/A${reminders.buyer}, ${autoDisputes} litige(s) auto`
        );
      }
    } catch (e) {
      this.log.warn(`escrow cron: ${(e as Error).message}`);
    }
  }
}
