import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CheptelModule } from "../cheptel/cheptel.module";
import { CommonModule } from "../common/common.module";
import { FinanceModule } from "../finance/finance.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FarmHealthController } from "./farm-health.controller";
import { FarmHealthService } from "./farm-health.service";
import { FarmVaccineController } from "./farm-vaccine.controller";
import { FarmVaccineService } from "./farm-vaccine.service";
import { VetFarmSummaryController } from "./vet-farm-summary.controller";
import { VetFarmSummaryService } from "./vet-farm-summary.service";
import { MemberActivityLogsModule } from "../member-activity-logs/member-activity-logs.module";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";

@Module({
  imports: [
    AuthModule,
    CommonModule,
    PrismaModule,
    FinanceModule,
    CheptelModule,
    SmartAlertsModule,
    MemberActivityLogsModule
  ],
  controllers: [
    FarmHealthController,
    FarmVaccineController,
    VetFarmSummaryController
  ],
  providers: [FarmHealthService, FarmVaccineService, VetFarmSummaryService],
  exports: [FarmHealthService, FarmVaccineService]
})
export class FarmHealthModule {}
