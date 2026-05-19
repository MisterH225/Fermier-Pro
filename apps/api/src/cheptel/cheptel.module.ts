import { Module } from "@nestjs/common";
import { FinanceModule } from "../finance/finance.module";
import { LivestockModule } from "../livestock/livestock.module";
import { CheptelController } from "./cheptel.controller";
import { CheptelService } from "./cheptel.service";

@Module({
  imports: [LivestockModule, FinanceModule],
  controllers: [CheptelController],
  providers: [CheptelService],
  exports: [CheptelService]
})
export class CheptelModule {}
