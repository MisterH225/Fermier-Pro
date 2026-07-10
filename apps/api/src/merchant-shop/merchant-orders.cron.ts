import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MerchantOrdersService } from "./merchant-orders.service";

@Injectable()
export class MerchantOrdersCronService {
  private readonly log = new Logger(MerchantOrdersCronService.name);

  constructor(private readonly orders: MerchantOrdersService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runTrackingCycle(): Promise<void> {
    this.log.log("Cron commandes boutique — auto-rejet / auto-complete");
    await this.orders.runTrackingCycle();
  }
}
