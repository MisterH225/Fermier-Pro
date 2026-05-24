import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { VetsModule } from "../vets/vets.module";
import { AdminAiService } from "./admin-ai.service";
import { AdminPlatformController } from "./admin-platform.controller";
import { AdminPlatformService } from "./admin-platform.service";
import { SuperAdminGuard } from "./super-admin.guard";

@Module({
  imports: [AuthModule, VetsModule, PushNotificationsModule, AiModule],
  controllers: [AdminPlatformController],
  providers: [AdminPlatformService, AdminAiService, SuperAdminGuard],
  exports: [AdminPlatformService, SuperAdminGuard]
})
export class AdminPlatformModule {}