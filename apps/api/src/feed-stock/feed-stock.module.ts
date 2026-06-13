import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { FinanceModule } from "../finance/finance.module";
import { PredictionsModule } from "../predictions/predictions.module";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";
import { FarmFeedController } from "./farm-feed.controller";
import { FarmFeedService } from "./farm-feed.service";
import { FeedFinanceLinkModule } from "../feed-finance-link/feed-finance-link.module";
import { FeedReconciliationCronService } from "./feed-reconciliation-cron.service";
import { MemberActivityLogsModule } from "../member-activity-logs/member-activity-logs.module";

@Module({
  imports: [
    AuthModule,
    ConfigClientModule,
    FinanceModule,
    SmartAlertsModule,
    FeedFinanceLinkModule,
    forwardRef(() => PredictionsModule),
    MemberActivityLogsModule
  ],
  controllers: [FarmFeedController],
  providers: [FarmFeedService, FeedReconciliationCronService]
})
export class FeedStockModule {}
