import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
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
import { FarmMembersModule } from "./farm-members/farm-members.module";
import { FarmsModule } from "./farms/farms.module";
import { FinanceModule } from "./finance/finance.module";
import { HealthEventsModule } from "./health-events/health-events.module";
import { HousingModule } from "./housing/housing.module";
import { InvitationsModule } from "./invitations/invitations.module";
import { LivestockModule } from "./livestock/livestock.module";
import { LivestockExitsModule } from "./livestock-exits/livestock-exits.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { TasksModule } from "./tasks/tasks.module";
import { VetConsultationsModule } from "./vet-consultations/vet-consultations.module";

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
    CommonModule,
    AuthModule,
    ChatModule,
    ProfilesModule,
    FarmsModule,
    FarmMembersModule,
    InvitationsModule,
    LivestockModule,
    LivestockExitsModule,
    TasksModule,
    FinanceModule,
    HealthEventsModule,
    HousingModule,
    MarketplaceModule,
    VetConsultationsModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard }
  ]
})
export class AppModule {}
