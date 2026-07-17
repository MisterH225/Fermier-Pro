import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AdminModerationModule } from "../admin-moderation/admin-moderation.module";
import { AuthModule } from "../auth/auth.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { UserNotificationsModule } from "../user-notifications/user-notifications.module";
import { VetsModule } from "../vets/vets.module";
import { AdminAiService } from "./admin-ai.service";
import { AdminConsoleAuthModule } from "./admin-console-auth.module";
import { AdminPlatformController } from "./admin-platform.controller";
import { AdminPlatformService } from "./admin-platform.service";
import { MarketModule } from "../market/market.module";
import { MarketplaceModule } from "../marketplace/marketplace.module";
import { VetAppointmentsModule } from "../vet-appointments/vet-appointments.module";
import { ProducerScoreModule } from "../producer-score/producer-score.module";
import { MerchantShopModule } from "../merchant-shop/merchant-shop.module";
import { ProducerSubscriptionModule } from "../producer-subscription/producer-subscription.module";
import { MobileMoneyModule } from "../marketplace/escrow";
import { AdminMerchantSubscriptionsService } from "./admin-merchant-subscriptions.service";
import { AdminProducerSubscriptionsService } from "./admin-producer-subscriptions.service";
import { InstitutionReportCsvService } from "./institution-report-csv.service";
import { InstitutionReportPdfService } from "./institution-report-pdf.service";
import { InstitutionReportService } from "./institution-report.service";
import { InstitutionScheduledReportCronService } from "./institution-scheduled-report-cron.service";
import { RegionStatsSnapshotCronService } from "./region-stats-snapshot-cron.service";
import { RegionStatsSnapshotService } from "./region-stats-snapshot.service";
import { RegionStatsService } from "./region-stats.service";
import { StatsQueryService } from "./stats-query.service";

@Module({
  imports: [
    AdminConsoleAuthModule,
    AuthModule,
    AdminModerationModule,
    VetsModule,
    PushNotificationsModule,
    UserNotificationsModule,
    AiModule,
    MarketModule,
    MarketplaceModule,
    MobileMoneyModule,
    VetAppointmentsModule,
    ProducerScoreModule,
    MerchantShopModule,
    ProducerSubscriptionModule
  ],
  controllers: [AdminPlatformController],
  providers: [
    AdminPlatformService,
    AdminAiService,
    AdminMerchantSubscriptionsService,
    AdminProducerSubscriptionsService,
    StatsQueryService,
    RegionStatsSnapshotService,
    RegionStatsSnapshotCronService,
    RegionStatsService,
    InstitutionReportPdfService,
    InstitutionReportCsvService,
    InstitutionReportService,
    InstitutionScheduledReportCronService
  ],
  exports: [AdminPlatformService, AdminConsoleAuthModule]
})
export class AdminPlatformModule {}
