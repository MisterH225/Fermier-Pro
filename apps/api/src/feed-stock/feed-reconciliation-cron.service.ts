import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DistributedLockService } from "../common/distributed-lock.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReconciliationEngine } from "../feed-finance-link/reconciliation-engine";

@Injectable()
export class FeedReconciliationCronService {
  private readonly log = new Logger(FeedReconciliationCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: ReconciliationEngine,
    private readonly locks: DistributedLockService
  ) {}

  /** Minuit UTC — scan des entrées sans coût ni rapprochement. */
  @Cron("0 0 * * *")
  async nightlyScan(): Promise<void> {
    await this.locks.withLock("cron:feed-reconciliation-nightly", async () => {
      this.log.log("Scan rapprochement stock aliment");
      const farms = await this.prisma.farm.findMany({
        select: { id: true },
        take: 500
      });
      for (const f of farms) {
        try {
          const n = await this.reconciliation.scanUnlinkedMovements(f.id);
          if (n > 0) {
            this.log.log(`Ferme ${f.id}: ${n} entrée(s) marquée(s) sans coût`);
          }
        } catch (e) {
          this.log.warn(`Scan ferme ${f.id}: ${(e as Error).message}`);
        }
      }
    });
  }
}
