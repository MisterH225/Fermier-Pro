import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";
import { FeedFinanceLinkService } from "./feed-finance-link.service";

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    AuthModule,
    ConfigClientModule,
    SmartAlertsModule
  ],
  providers: [FeedFinanceLinkService],
  exports: [FeedFinanceLinkService]
})
export class FeedFinanceLinkModule {}
