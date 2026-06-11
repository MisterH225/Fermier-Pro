import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module";
import { FinanceModule } from "../finance/finance.module";
import { PredictionsModule } from "../predictions/predictions.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ProfitabilityModule } from "../profitability/profitability.module";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";
import { FarmReportsController } from "./farm-reports.controller";
import { ReportsPdfmakeService } from "./reports-pdfmake.service";
import { ReportsRootController } from "./reports-root.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    AuthModule,
    FinanceModule,
    ProfitabilityModule,
    PredictionsModule,
    SmartAlertsModule,
    FeatureFlagsModule
  ],
  controllers: [FarmReportsController, ReportsRootController],
  providers: [ReportsService, ReportsPdfmakeService]
})
export class ReportsModule {}
