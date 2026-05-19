import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { TasksService } from "./tasks.service";

@Injectable()
export class TasksCronService {
  private readonly logger = new Logger(TasksCronService.name);

  constructor(private readonly tasks: TasksService) {}

  /** Rappel J-1 — chaque soir 20h UTC. */
  @Cron("0 20 * * *")
  async reminderJob(): Promise<void> {
    try {
      await this.tasks.runReminderNotifications();
    } catch (e) {
      this.logger.error("tasks reminder cron failed", e);
    }
  }

  /** Escalade tâches en retard — chaque matin 8h UTC. */
  @Cron("0 8 * * *")
  async escalationJob(): Promise<void> {
    try {
      await this.tasks.runEscalationNotifications();
    } catch (e) {
      this.logger.error("tasks escalation cron failed", e);
    }
  }
}
