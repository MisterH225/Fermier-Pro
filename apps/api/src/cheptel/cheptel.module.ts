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
import { GrowthSimulationCronService } from "./growth-simulation-cron.service";
import { GrowthSimulationService } from "./growth-simulation.service";
import { MarketplaceModule } from "../marketplace/marketplace.module";

@Module({
  imports: [
    AuthModule,
    CommonModule,
    forwardRef(() => LivestockModule),
    FinanceModule,
    HousingModule,
    AgeCalculationModule,
    forwardRef(() => SmartAlertsModule),
    forwardRef(() => MarketplaceModule)
  ],
  controllers: [CheptelController],
  providers: [
    CheptelService,
    GrowthSimulationService,
    GrowthSimulationCronService
  ],
  exports: [CheptelService, AgeCalculationModule, GrowthSimulationService]
})
export class CheptelModule {}
