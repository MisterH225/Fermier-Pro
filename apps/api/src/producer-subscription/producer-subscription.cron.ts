import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ProducerSubscriptionBillingService } from "./producer-subscription-billing.service";

@Injectable()
export class ProducerSubscriptionCronService {
  private readonly log = new Logger(ProducerSubscriptionCronService.name);

  constructor(private readonly billing: ProducerSubscriptionBillingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDailyBilling(): Promise<void> {
    this.log.log("Cron abo producteur — cycle journalier");
    await this.billing.runBillingCycle();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runHourlyBilling(): Promise<void> {
    const cfg = await this.billing.getBillingConfig();
    if (cfg.billingUnit !== "hour" && !cfg.trialEnabled) {
      return;
    }
    this.log.log("Cron abo producteur — tick horaire");
    await this.billing.runBillingCycle();
  }
}
