import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MerchantSubscriptionBillingService } from "./merchant-subscription-billing.service";

@Injectable()
export class MerchantSubscriptionCronService {
  private readonly log = new Logger(MerchantSubscriptionCronService.name);

  constructor(private readonly billing: MerchantSubscriptionBillingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDailyBilling(): Promise<void> {
    this.log.log("Cron abonnement commerçant — cycle de facturation");
    await this.billing.runDailyBillingCycle();
  }
}
