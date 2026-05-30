import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { FinanceModule } from "../finance/finance.module";
import { HousingModule } from "../housing/housing.module";
import { LivestockModule } from "../livestock/livestock.module";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";
import { AgeCalculationModule } from "./age-calculation.module";
import { CheptelController } from "./cheptel.controller";
import { CheptelService } from "./cheptel.service";

@Module({
  imports: [
    AuthModule,
    CommonModule,
    LivestockModule,
    FinanceModule,
    HousingModule,
    AgeCalculationModule,
    forwardRef(() => SmartAlertsModule)
  ],
  controllers: [CheptelController],
  providers: [CheptelService],
  exports: [CheptelService, AgeCalculationModule]
})
export class CheptelModule {}
