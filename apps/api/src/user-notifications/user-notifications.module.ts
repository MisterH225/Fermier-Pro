import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { UserNotificationsService } from "./user-notifications.service";

@Module({
  imports: [PrismaModule, PushNotificationsModule],
  providers: [UserNotificationsService],
  exports: [UserNotificationsService]
})
export class UserNotificationsModule {}
