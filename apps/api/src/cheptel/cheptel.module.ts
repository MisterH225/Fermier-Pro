import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { FinanceModule } from "../finance/finance.module";
import { HousingModule } from "../housing/housing.module";
import { LivestockModule } from "../livestock/livestock.module";
import { CheptelController } from "./cheptel.controller";
import { CheptelService } from "./cheptel.service";

@Module({
  imports: [
    AuthModule,
    CommonModule,
    LivestockModule,
    FinanceModule,
    HousingModule
  ],
  controllers: [CheptelController],
  providers: [CheptelService],
  exports: [CheptelService]
})
export class CheptelModule {}
