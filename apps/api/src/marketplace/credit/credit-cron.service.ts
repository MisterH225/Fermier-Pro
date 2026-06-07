import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CreditOffersService } from "./credit-offers.service";

@Injectable()
export class CreditCronService {
  private readonly log = new Logger(CreditCronService.name);

  constructor(private readonly creditOffers: CreditOffersService) {}

  @Cron("0 8 * * *")
  async dailyCreditReminders(): Promise<void> {
    try {
      const { reminders, arbitrations } =
        await this.creditOffers.handleCreditReminders();
      if (reminders > 0 || arbitrations > 0) {
        this.log.log(
          `Credit cron: ${reminders} rappel(s), ${arbitrations} arbitrage(s)`
        );
      }
    } catch (e) {
      this.log.warn(`credit cron: ${(e as Error).message}`);
    }
  }
}
