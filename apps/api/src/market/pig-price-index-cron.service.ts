import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PigPriceIndexService } from "./pig-price-index.service";

@Injectable()
export class PigPriceIndexCronService {
  private readonly log = new Logger(PigPriceIndexCronService.name);

  constructor(private readonly index: PigPriceIndexService) {}

  /** Recalcul horaire — journée en cours. */
  @Cron("0 * * * *")
  async hourlyRefresh(): Promise<void> {
    this.log.log("PigPrice Index — recalcul horaire");
    try {
      await this.index.calculateRecentDays();
    } catch (e) {
      this.log.warn(`hourly refresh: ${(e as Error).message}`);
    }
  }

  /** Minuit UTC — finaliser la veille. */
  @Cron("0 0 * * *")
  async midnightFinalize(): Promise<void> {
    this.log.log("PigPrice Index — finalisation minuit");
    try {
      await this.index.calculateRecentDays();
    } catch (e) {
      this.log.warn(`midnight finalize: ${(e as Error).message}`);
    }
  }
}
