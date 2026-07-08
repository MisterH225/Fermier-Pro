import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MerchantSubscriptionBillingService } from "./merchant-subscription-billing.service";

@Injectable()
export class MerchantSubscriptionCronService {
  private readonly log = new Logger(MerchantSubscriptionCronService.name);

  constructor(private readonly billing: MerchantSubscriptionBillingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDailyBilling(): Promise<void> {
    this.log.log("Cron abo commerçant — cycle journalier");
    await this.billing.runBillingCycle();
  }

  /** Couvre les périodicités horaires / fin d'essai. */
  @Cron(CronExpression.EVERY_HOUR)
  async runHourlyBilling(): Promise<void> {
    const cfg = await this.billing.getBillingConfig();
    if (cfg.billingUnit !== "hour" && !cfg.trialEnabled) {
      return;
    }
    this.log.log("Cron abo commerçant — tick horaire");
    await this.billing.runBillingCycle();
  }
}
