import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { FinanceModule } from "../finance/finance.module";
import { GestationModule } from "../gestation/gestation.module";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";
import { FarmSettingsController } from "./farm-settings.controller";
import { FarmSettingsService } from "./farm-settings.service";

@Module({
  imports: [
    AuthModule,
    CommonModule,
    FinanceModule,
    SmartAlertsModule,
    GestationModule
  ],
  controllers: [FarmSettingsController],
  providers: [FarmSettingsService],
  exports: [FarmSettingsService]
})
export class FarmSettingsModule {}
