import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";

@Module({
  imports: [AuthModule, ConfigClientModule],
  controllers: [ListingsController, OffersController],
  providers: [ListingsService, OffersService]
})
export class MarketplaceModule {}
