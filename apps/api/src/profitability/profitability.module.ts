import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { ProfitabilityController } from "./profitability.controller";
import { ProfitabilityService } from "./profitability.service";

@Module({
  imports: [AuthModule, ConfigClientModule],
  controllers: [ProfitabilityController],
  providers: [ProfitabilityService],
  exports: [ProfitabilityService]
})
export class ProfitabilityModule {}
