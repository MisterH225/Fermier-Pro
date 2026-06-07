import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MarketplacePigPriceIndexService } from "./pig-price-index.service";

@Injectable()
export class MarketplacePigPriceIndexCronService {
  private readonly log = new Logger(MarketplacePigPriceIndexCronService.name);

  constructor(private readonly index: MarketplacePigPriceIndexService) {}

  /** Recalcul hybride toutes les 6 heures. */
  @Cron("0 */6 * * *")
  async refreshHybridIndex(): Promise<void> {
    this.log.log("PigPrice hybrid index — recalcul 6h");
    try {
      await this.index.calculateHybridIndex();
    } catch (e) {
      this.log.warn(`hybrid refresh: ${(e as Error).message}`);
    }
  }
}
