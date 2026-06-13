import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { AiModule } from "../ai/ai.module";
import { BudgetService } from "./budget.service";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";
import { FeedFinanceLinkModule } from "../feed-finance-link/feed-finance-link.module";
import { ProfitabilityModule } from "../profitability/profitability.module";

@Module({
  imports: [
    AuthModule,
    ConfigClientModule,
    AiModule,
    SmartAlertsModule,
    FeedFinanceLinkModule,
    ProfitabilityModule
  ],
  controllers: [FinanceController],
  providers: [FinanceService, BudgetService],
  exports: [FinanceService, BudgetService]
})
export class FinanceModule {}
