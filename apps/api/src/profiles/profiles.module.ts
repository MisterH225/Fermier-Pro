import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProfileDeactivationService } from "./profile-deactivation.service";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";

@Module({
  imports: [AuthModule],
  controllers: [ProfilesController],
  providers: [ProfilesService, ProfileDeactivationService],
  exports: [ProfilesService, ProfileDeactivationService]
})
export class ProfilesModule {}
