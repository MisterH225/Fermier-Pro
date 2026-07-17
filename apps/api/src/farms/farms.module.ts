import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InvitationsModule } from "../invitations/invitations.module";
import { LivestockModule } from "../livestock/livestock.module";
import { PushNotificationsModule } from "../push-notifications/push-notifications.module";
import { MarketplaceModule } from "../marketplace/marketplace.module";
import { FarmsController } from "./farms.controller";
import { FarmsService } from "./farms.service";
import { FarmDeletionService } from "./farm-deletion.service";
import { FarmDataPurgeModule } from "./farm-data-purge.module";
import { GeoRollupService } from "./geo/geo-rollup.service";

@Module({
  imports: [
    AuthModule,
    FarmDataPurgeModule,
    InvitationsModule,
    LivestockModule,
    PushNotificationsModule,
    MarketplaceModule
  ],
  controllers: [FarmsController],
  providers: [FarmsService, FarmDeletionService, GeoRollupService],
  exports: [FarmsService, GeoRollupService]
})
export class FarmsModule {}
