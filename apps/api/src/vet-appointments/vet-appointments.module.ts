import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppEventsModule } from "../app-events/app-events.module";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { UserNotificationsModule } from "../user-notifications/user-notifications.module";
import { WalletModule } from "../wallet/wallet.module";
import { VetAppointmentController } from "./vet-appointment.controller";
import { VetAppointmentCronService } from "./vet-appointment.cron";
import { VetAppointmentService } from "./vet-appointment.service";
import { VetCalendarService } from "./vet-calendar.service";

@Module({
  imports: [
    AuthModule,
    CommonModule,
    PrismaModule,
    ConfigModule,
    PushNotificationsModule,
    UserNotificationsModule,
    WalletModule,
    AppEventsModule
  ],
  controllers: [VetAppointmentController],
  providers: [
    VetAppointmentService,
    VetCalendarService,
    VetAppointmentCronService
  ],
  exports: [VetAppointmentService, VetCalendarService]
})
export class VetAppointmentsModule {}
