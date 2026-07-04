import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DistributedLockService } from "../common/distributed-lock.service";
import { PigPriceIndexService } from "./pig-price-index.service";

@Injectable()
export class PigPriceIndexCronService {
  private readonly log = new Logger(PigPriceIndexCronService.name);

  constructor(
    private readonly index: PigPriceIndexService,
    private readonly locks: DistributedLockService
  ) {}

  /** Recalcul horaire — journée en cours. */
  @Cron("0 * * * *")
  async hourlyRefresh(): Promise<void> {
    await this.locks.withLock("cron:pig-price-index-hourly", async () => {
      this.log.log("PigPrice Index — recalcul horaire");
      try {
        await this.index.calculateRecentDays();
      } catch (e) {
        this.log.warn(`hourly refresh: ${(e as Error).message}`);
      }
    });
  }

  /** Minuit UTC — finaliser la veille. */
  @Cron("0 0 * * *")
  async midnightFinalize(): Promise<void> {
    await this.locks.withLock("cron:pig-price-index-midnight", async () => {
      this.log.log("PigPrice Index — finalisation minuit");
      try {
        await this.index.calculateRecentDays();
      } catch (e) {
        this.log.warn(`midnight finalize: ${(e as Error).message}`);
      }
    });
  }

  /** Recalcul hybride anti-manipulation toutes les 6 heures. */
  @Cron("0 */6 * * *")
  async refreshHybridIndex(): Promise<void> {
    await this.locks.withLock("cron:pig-price-index-hybrid", async () => {
      this.log.log("PigPrice hybrid index — recalcul 6h");
      try {
        await this.index.calculateHybridIndex();
      } catch (e) {
        this.log.warn(`hybrid refresh: ${(e as Error).message}`);
      }
    });
  }
}
