import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { SmartAlertsService } from "./smart-alerts.service";

@Injectable()
export class SmartAlertsCronService {
  private readonly log = new Logger(SmartAlertsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smartAlerts: SmartAlertsService
  ) {}

  /** Recalcul nocturne (03:00 serveur). */
  @Cron("0 3 * * *")
  async nightlyRefreshAllFarms(): Promise<void> {
    const farms = await this.prisma.farm.findMany({ select: { id: true } });
    this.log.log(`SmartAlerts nightly refresh — ${farms.length} fermes`);
    for (const f of farms) {
      try {
        await this.smartAlerts.refreshInternal(f.id);
      } catch (e) {
        this.log.warn(`refresh farm ${f.id}: ${(e as Error).message}`);
      }
    }
  }
}
