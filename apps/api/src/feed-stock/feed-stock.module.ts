import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { FinanceModule } from "../finance/finance.module";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";
import { FarmFeedController } from "./farm-feed.controller";
import { FarmFeedService } from "./farm-feed.service";
import { FeedFinanceLinkModule } from "../feed-finance-link/feed-finance-link.module";

@Module({
  imports: [
    AuthModule,
    ConfigClientModule,
    FinanceModule,
    SmartAlertsModule,
    FeedFinanceLinkModule
  ],
  controllers: [FarmFeedController],
  providers: [FarmFeedService]
})
export class FeedStockModule {}
