import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AdoptionMetricsController } from "./adoption-metrics.controller";
import { AdoptionMetricsService } from "./adoption-metrics.service";
import { AppEventsService } from "./app-events.service";
import { ListingHealthBadgeAggregateService } from "./listing-health-badge.service";

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [AdoptionMetricsController],
  providers: [
    AppEventsService,
    ListingHealthBadgeAggregateService,
    AdoptionMetricsService
  ],
  exports: [AppEventsService, ListingHealthBadgeAggregateService]
})
export class AppEventsModule {}
