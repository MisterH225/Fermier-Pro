import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { DistributedLockService } from "../common/distributed-lock.service";
import { UserNotificationsService } from "../user-notifications/user-notifications.service";
import { AdminConsoleAccessService } from "./admin-console-access.service";
import { InstitutionReportService } from "./institution-report.service";
import {
  parseScheduledReportsConfig,
  previousPeriodRange,
  shouldRunScheduledReport
} from "./institution-scheduled-reports.util";
import type { InstitutionStatSection } from "./institution-stats-sections.constants";

@Injectable()
export class InstitutionScheduledReportCronService {
  private readonly log = new Logger(InstitutionScheduledReportCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly locks: DistributedLockService,
    private readonly reports: InstitutionReportService,
    private readonly consoleAccess: AdminConsoleAccessService,
    private readonly notifications: UserNotificationsService
  ) {}

  /** 1er du mois à 06:00 UTC — rapports mensuels. */
  @Cron("0 6 1 * *")
  async monthlyReports(): Promise<void> {
    await this.runCadence("monthly");
  }

  /** Chaque lundi à 06:00 UTC — rapports hebdomadaires. */
  @Cron("0 6 * * 1")
  async weeklyReports(): Promise<void> {
    await this.runCadence("weekly");
  }

  private async runCadence(cadence: "monthly" | "weekly"): Promise<void> {
    await this.locks.withLock(`cron:institution-reports-${cadence}`, async () => {
      const institutions = await this.prisma.institutionConsoleUser.findMany({
        where: { isActive: true },
        include: {
          user: { select: { id: true, email: true } }
        }
      });

      for (const row of institutions) {
        const config = parseScheduledReportsConfig(row.scheduledReports);
        if (!config || config.cadence !== cadence) {
          continue;
        }
        if (!shouldRunScheduledReport(config)) {
          continue;
        }

        try {
          await this.generateForInstitution(row.id, row.userId, config.sections, {
            format: config.format,
            cadence
          });
          await this.prisma.institutionConsoleUser.update({
            where: { id: row.id },
            data: {
              scheduledReports: {
                ...config,
                lastRunAt: new Date().toISOString()
              }
            }
          });
        } catch (e) {
          this.log.warn(
            `Rapport programmé ${cadence} institution ${row.id}: ${(e as Error).message}`
          );
        }
      }
    });
  }

  async generateForInstitution(
    institutionAccessId: string,
    userId: string,
    sections: InstitutionStatSection[],
    options: {
      format: "pdf" | "csv";
      cadence: "monthly" | "weekly";
    }
  ): Promise<void> {
    const profile = await this.consoleAccess.getAccessProfile(userId);
    if (!profile || profile.role !== "institution") {
      return;
    }

    const { from, to } = previousPeriodRange(options.cadence);
    const result = await this.reports.buildReport({
      context: { profile, isInstitutionPreview: false },
      sections,
      from,
      to,
      format: options.format,
      persistToStorage: true
    });

    const title = "Rapport statistiques disponible";
    const body = `Votre rapport ${options.cadence === "monthly" ? "mensuel" : "hebdomadaire"} (${from} → ${to}) est prêt.`;
    await this.notifications.notify(userId, title, body, {
      type: "institution_stats_report",
      format: options.format,
      from,
      to,
      ...(result.downloadUrl ? { downloadUrl: result.downloadUrl } : {}),
      ...(result.storagePath ? { storagePath: result.storagePath } : {})
    });
  }
}
