import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DistributedLockService } from "../common/distributed-lock.service";
import { RegionStatsSnapshotService } from "./region-stats-snapshot.service";

@Injectable()
export class RegionStatsSnapshotCronService {
  private readonly log = new Logger(RegionStatsSnapshotCronService.name);

  constructor(
    private readonly snapshots: RegionStatsSnapshotService,
    private readonly locks: DistributedLockService
  ) {}

  /** Minuit UTC — agrège la veille par département. */
  @Cron("0 0 * * *")
  async nightlySnapshot(): Promise<void> {
    await this.locks.withLock("cron:region-stats-daily", async () => {
      this.log.log("RegionStatsDaily — agrégation nocturne");
      try {
        await this.snapshots.snapshotYesterday();
      } catch (e) {
        this.log.warn(`nightly snapshot: ${(e as Error).message}`);
      }
    });
  }
}
