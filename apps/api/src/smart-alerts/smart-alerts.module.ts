import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { PrismaModule } from "../prisma/prisma.module";
import { UserNotificationsModule } from "../user-notifications/user-notifications.module";
import { FarmSmartAlertsController } from "./farm-smart-alerts.controller";
import { SmartAlertsCronService } from "./smart-alerts-cron.service";
import { SmartAlertsService } from "./smart-alerts.service";

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    UserNotificationsModule,
    forwardRef(() => AuthModule)
  ],
  controllers: [FarmSmartAlertsController],
  providers: [SmartAlertsService, SmartAlertsCronService],
  exports: [SmartAlertsService]
})
export class SmartAlertsModule {}
