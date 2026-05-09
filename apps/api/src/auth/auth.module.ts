import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OptionalActiveProfileGuard } from "./guards/optional-active-profile.guard";
import { ProducerProfileGuard } from "./guards/producer-profile.guard";
import { SupabaseJwtGuard } from "./guards/supabase-jwt.guard";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SupabaseJwtGuard,
    OptionalActiveProfileGuard,
    ProducerProfileGuard
  ],
  exports: [
    AuthService,
    SupabaseJwtGuard,
    OptionalActiveProfileGuard,
    ProducerProfileGuard
  ]
})
export class AuthModule {}
