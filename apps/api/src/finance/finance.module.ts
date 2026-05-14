import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";

@Module({
  imports: [AuthModule, ConfigClientModule, SmartAlertsModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService]
})
export class FinanceModule {}
