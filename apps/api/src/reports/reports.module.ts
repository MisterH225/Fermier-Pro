import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { FinanceModule } from "../finance/finance.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";
import { FarmReportsController } from "./farm-reports.controller";
import { ReportsPdfService } from "./reports-pdf.service";
import { ReportsRootController } from "./reports-root.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [PrismaModule, CommonModule, AuthModule, FinanceModule, SmartAlertsModule],
  controllers: [FarmReportsController, ReportsRootController],
  providers: [ReportsService, ReportsPdfService]
})
export class ReportsModule {}
