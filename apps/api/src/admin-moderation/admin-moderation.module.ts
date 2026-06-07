import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { AdminUserModerationService } from "../admin-platform/admin-user-moderation.service";

@Module({
  imports: [forwardRef(() => AuthModule), PushNotificationsModule],
  providers: [AdminUserModerationService],
  exports: [AdminUserModerationService]
})
export class AdminModerationModule {}
