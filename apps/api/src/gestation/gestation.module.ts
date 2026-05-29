import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";
import { GestationController } from "./gestation.controller";
import { GestationService } from "./gestation.service";

@Module({
  imports: [AuthModule, CommonModule, SmartAlertsModule, FeatureFlagsModule],
  controllers: [GestationController],
  providers: [GestationService],
  exports: [GestationService]
})
export class GestationModule {}
