import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { CommonModule } from "../common/common.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";
import { FeedFinanceLinkService } from "./feed-finance-link.service";
import { PumpCalculator } from "./pump-calculator";
import { ReconciliationEngine } from "./reconciliation-engine";

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    AuthModule,
    ConfigClientModule,
    SmartAlertsModule,
    AiModule
  ],
  providers: [FeedFinanceLinkService, PumpCalculator, ReconciliationEngine],
  exports: [FeedFinanceLinkService, PumpCalculator, ReconciliationEngine]
})
export class FeedFinanceLinkModule {}
