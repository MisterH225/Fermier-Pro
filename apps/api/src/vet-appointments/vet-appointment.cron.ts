import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { VetAppointmentService } from "./vet-appointment.service";

@Injectable()
export class VetAppointmentCronService {
  private readonly log = new Logger(VetAppointmentCronService.name);

  constructor(private readonly appointments: VetAppointmentService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async expireAwaitingPayment() {
    const n = await this.appointments.handleExpiredPayments();
    if (n > 0) {
      this.log.log(`Expired ${n} vet appointment(s) awaiting payment`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async sendReminders() {
    const n = await this.appointments.sendUpcomingReminders();
    if (n > 0) {
      this.log.log(`Sent ${n} vet appointment reminder(s)`);
    }
  }
}
