import { Module, forwardRef } from "@nestjs/common";
import { MarketplaceModule } from "../marketplace/marketplace.module";
import { FarmDataPurgeService } from "./farm-data-purge.service";

@Module({
  imports: [forwardRef(() => MarketplaceModule)],
  providers: [FarmDataPurgeService],
  exports: [FarmDataPurgeService]
})
export class FarmDataPurgeModule {}
