import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { HealthBadgeExpiryService } from "./health-badge-expiry.service";

@Injectable()
export class HealthBadgeExpiryCronService {
  private readonly log = new Logger(HealthBadgeExpiryCronService.name);

  constructor(private readonly expiry: HealthBadgeExpiryService) {}

  /** Relances badge Santé J-5 — tous les jours à 7h UTC. */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async sendHealthBadgeExpiryReminders(): Promise<void> {
    try {
      const result = await this.expiry.sendExpiryReminders();
      if (result.farmsNotified > 0 || result.skippedDuplicate > 0) {
        this.log.log(
          `Health badge expiry: ${result.farmsNotified} ferme(s), ` +
            `${result.producerNotifications} prod., ${result.vetNotifications} véto(s), ` +
            `${result.skippedNoListing} sans annonce, ${result.skippedDuplicate} déjà notifié(s)`
        );
      }
    } catch (e) {
      this.log.error("health badge expiry cron failed", e);
    }
  }
}
