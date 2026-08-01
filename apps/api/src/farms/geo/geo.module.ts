import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { GeoRollupService } from "./geo-rollup.service";

/**
 * Module géo P-10 — GeoRollupService sans couplage Farms/Marketplace.
 * Importé par FarmsModule et MerchantShopModule.
 */
@Module({
  imports: [PrismaModule],
  providers: [GeoRollupService],
  exports: [GeoRollupService]
})
export class GeoModule {}
