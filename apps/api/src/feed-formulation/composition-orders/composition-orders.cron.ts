import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DistributedLockService } from "../../common/distributed-lock.service";
import { CompositionOrdersService } from "./composition-orders.service";

/**
 * Cron P-J5 : libération automatique escrow composition en fin de fenêtre litige
 * (sans confirmation ni litige). withLock Redis — même pattern que marketplace escrow.
 */
@Injectable()
export class CompositionOrdersCronService {
  private readonly log = new Logger(CompositionOrdersCronService.name);

  constructor(
    private readonly orders: CompositionOrdersService,
    private readonly locks: DistributedLockService
  ) {}

  @Cron("15 * * * *")
  async hourlyCompositionTracking(): Promise<void> {
    await this.locks.withLock("cron:composition-order-hourly", async () => {
      try {
        const released = await this.orders.runTrackingCycle();
        if (released > 0) {
          this.log.log(
            `Composition cron: ${released} libération(s) auto (fenêtre litige)`
          );
        }
      } catch (e) {
        this.log.warn(`composition cron: ${(e as Error).message}`);
      }
    });
  }
}
