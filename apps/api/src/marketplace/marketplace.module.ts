import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { FarmRatingsController } from "./farm-ratings.controller";
import { FarmRatingsService } from "./farm-ratings.service";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";

@Module({
  imports: [AuthModule, ConfigClientModule],
  controllers: [ListingsController, OffersController, FarmRatingsController],
  providers: [ListingsService, OffersService, FarmRatingsService]
})
export class MarketplaceModule {}
