import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD } from "@nestjs/core";
import {
  ThrottlerGuard,
  ThrottlerModule,
  type ThrottlerModuleOptions
} from "@nestjs/throttler";
import { join } from "path";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ChatModule } from "./chat/chat.module";
import { CommonModule } from "./common/common.module";
import { ConfigClientModule } from "./config-client/config-client.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { FarmMembersModule } from "./farm-members/farm-members.module";
import { FarmsModule } from "./farms/farms.module";
import { FinanceModule } from "./finance/finance.module";
import { HealthEventsModule } from "./health-events/health-events.module";
import { HousingModule } from "./housing/housing.module";
import { InvitationsModule } from "./invitations/invitations.module";
import { LivestockModule } from "./livestock/livestock.module";
import { LivestockExitsModule } from "./livestock-exits/livestock-exits.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { PlatformSettingsModule } from "./platform-settings/platform-settings.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { PushNotificationsModule } from "./push-notifications/push-notifications.module";
import { TasksModule } from "./tasks/tasks.module";
import { VetConsultationsModule } from "./vet-consultations/vet-consultations.module";
import { FeedStockModule } from "./feed-stock/feed-stock.module";
import { FarmHealthModule } from "./farm-health/farm-health.module";
import { MemberActivityLogsModule } from "./member-activity-logs/member-activity-logs.module";
import { SmartAlertsModule } from "./smart-alerts/smart-alerts.module";
import { ReportsModule } from "./reports/reports.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { CheptelModule } from "./cheptel/cheptel.module";
import { CguModule } from "./cgu/cgu.module";
import { AiModule } from "./ai/ai.module";
import { GestationModule } from "./gestation/gestation.module";
import { VetsModule } from "./vets/vets.module";
import { VetAppointmentsModule } from "./vet-appointments/vet-appointments.module";
import { AdminPlatformModule } from "./admin-platform/admin-platform.module";
import { FeatureFlagsModule } from "./feature-flags/feature-flags.module";
import { MarketModule } from "./market/market.module";
import { BuyerProfilesModule } from "./buyer-profiles/buyer-profiles.module";
import { BuyerWalletModule } from "./buyer-wallet/buyer-wallet.module";
import { TechnicianProfilesModule } from "./technician-profiles/technician-profiles.module";
import { FarmSettingsModule } from "./farm-settings/farm-settings.module";
import { PredictionsModule } from "./predictions/predictions.module";
import { CommunityFeedModule } from "./community-feed/community-feed.module";
import { ProducerScoreModule } from "./producer-score/producer-score.module";
import { ProfitabilityModule } from "./profitability/profitability.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), ".env"),
        join(process.cwd(), "../../.env"),
        ".env",
        "../../.env"
      ]
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): ThrottlerModuleOptions => {
        const ttl = Number(config.get("THROTTLE_TTL_MS", 60_000));
        const limit = Number(config.get("THROTTLE_LIMIT", 200));
        const throttlers = [
          {
            name: "default",
            ttl: Number.isFinite(ttl) && ttl > 0 ? ttl : 60_000,
            limit: Number.isFinite(limit) && limit > 0 ? limit : 200
          }
        ];
        const redisUrl = config.get<string>("REDIS_URL")?.trim();
        if (redisUrl) {
          return {
            throttlers,
            storage: new ThrottlerStorageRedisService(redisUrl)
          };
        }
        return throttlers;
      }
    }),
    PrismaModule,
    PlatformSettingsModule,
    CommonModule,
    ConfigClientModule,
    DashboardModule,
    AuthModule,
    CguModule,
    ChatModule,
    ProfilesModule,
    FarmsModule,
    FarmMembersModule,
    InvitationsModule,
    LivestockModule,
    LivestockExitsModule,
    PushNotificationsModule,
    TasksModule,
    FinanceModule,
    HealthEventsModule,
    HousingModule,
    MarketplaceModule,
    VetConsultationsModule,
    FeedStockModule,
    FarmHealthModule,
    MemberActivityLogsModule,
    SmartAlertsModule,
    ReportsModule,
    OnboardingModule,
    CheptelModule,
    AiModule,
    GestationModule,
    VetsModule,
    VetAppointmentsModule,
    AdminPlatformModule,
    FeatureFlagsModule,
    MarketModule,
    BuyerProfilesModule,
    BuyerWalletModule,
    TechnicianProfilesModule,
    FarmSettingsModule,
    PredictionsModule,
    CommunityFeedModule,
    ProfitabilityModule,
    ProducerScoreModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard }
  ]
})
export class AppModule {}
