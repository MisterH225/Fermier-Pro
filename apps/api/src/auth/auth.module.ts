import { Module, forwardRef } from "@nestjs/common";
import { AdminModerationModule } from "../admin-moderation/admin-moderation.module";
import { CguModule } from "../cgu/cgu.module";
import { FarmDataPurgeModule } from "../farms/farm-data-purge.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { UserNotificationsModule } from "../user-notifications/user-notifications.module";
import { AccountDeletionService } from "./account-deletion.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SupabaseSendSmsWebhookController } from "./sms/supabase-send-sms-webhook.controller";
import { YellikaSmsClient } from "./sms/yellika-sms.client";
import { OptionalActiveProfileGuard } from "./guards/optional-active-profile.guard";
import { ActiveProfileGuard } from "./guards/active-profile.guard";
import { ProducerProfileGuard } from "./guards/producer-profile.guard";
import { SupabaseAdminService } from "./supabase-admin.service";
import { SupabaseJwtGuard } from "./guards/supabase-jwt.guard";

@Module({
  imports: [
    PushNotificationsModule,
    UserNotificationsModule,
    forwardRef(() => AdminModerationModule),
    forwardRef(() => CguModule),
    forwardRef(() => FarmDataPurgeModule)
  ],
  controllers: [AuthController, SupabaseSendSmsWebhookController],
  providers: [
    AuthService,
    AccountDeletionService,
    SupabaseAdminService,
    YellikaSmsClient,
    SupabaseJwtGuard,
    OptionalActiveProfileGuard,
    ActiveProfileGuard,
    ProducerProfileGuard
  ],
  exports: [
    AuthService,
    AccountDeletionService,
    SupabaseAdminService,
    YellikaSmsClient,
    SupabaseJwtGuard,
    OptionalActiveProfileGuard,
    ActiveProfileGuard,
    ProducerProfileGuard
  ]
})
export class AuthModule {}
