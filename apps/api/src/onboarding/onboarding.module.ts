import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InvitationsModule } from "../invitations/invitations.module";
import { LivestockModule } from "../livestock/livestock.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [AuthModule, InvitationsModule, LivestockModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService]
})
export class OnboardingModule {}
