import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InvitationsModule } from "../invitations/invitations.module";
import { LivestockModule } from "../livestock/livestock.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { FarmsController } from "./farms.controller";
import { FarmsService } from "./farms.service";
import { FarmDeletionService } from "./farm-deletion.service";

@Module({
  imports: [AuthModule, InvitationsModule, LivestockModule, PushNotificationsModule],
  controllers: [FarmsController],
  providers: [FarmsService, FarmDeletionService],
  exports: [FarmsService]
})
export class FarmsModule {}
