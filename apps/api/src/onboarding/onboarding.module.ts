import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FarmsModule } from "../farms/farms.module";
import { InvitationsModule } from "../invitations/invitations.module";
import { LivestockModule } from "../livestock/livestock.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [AuthModule, InvitationsModule, LivestockModule, FarmsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService]
})
export class OnboardingModule {}
