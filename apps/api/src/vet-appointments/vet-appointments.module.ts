import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { DevMobileMoneyGateway } from "../marketplace/escrow/dev-mobile-money.gateway";
import { MOBILE_MONEY_GATEWAY } from "../marketplace/escrow/mobile-money.gateway";
import { PrismaModule } from "../prisma/prisma.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
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
    PushNotificationsModule
  ],
  controllers: [VetAppointmentController],
  providers: [
    VetAppointmentService,
    VetCalendarService,
    VetAppointmentCronService,
    DevMobileMoneyGateway,
    { provide: MOBILE_MONEY_GATEWAY, useExisting: DevMobileMoneyGateway }
  ],
  exports: [VetAppointmentService, VetCalendarService]
})
export class VetAppointmentsModule {}
