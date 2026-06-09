import { Module, forwardRef } from "@nestjs/common";
import { AdminModerationModule } from "../admin-moderation/admin-moderation.module";
import { CguModule } from "../cgu/cgu.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { AccountDeletionService } from "./account-deletion.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OptionalActiveProfileGuard } from "./guards/optional-active-profile.guard";
import { ActiveProfileGuard } from "./guards/active-profile.guard";
import { ProducerProfileGuard } from "./guards/producer-profile.guard";
import { SupabaseAdminService } from "./supabase-admin.service";
import { SupabaseJwtGuard } from "./guards/supabase-jwt.guard";

@Module({
  imports: [
    PushNotificationsModule,
    forwardRef(() => AdminModerationModule),
    forwardRef(() => CguModule)
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountDeletionService,
    SupabaseAdminService,
    SupabaseJwtGuard,
    OptionalActiveProfileGuard,
    ActiveProfileGuard,
    ProducerProfileGuard
  ],
  exports: [
    AuthService,
    AccountDeletionService,
    SupabaseAdminService,
    SupabaseJwtGuard,
    OptionalActiveProfileGuard,
    ActiveProfileGuard,
    ProducerProfileGuard
  ]
})
export class AuthModule {}
