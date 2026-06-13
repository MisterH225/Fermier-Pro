import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { AiModule } from "../ai/ai.module";
import { ProfitabilityController } from "./profitability.controller";
import { ProfitabilityEngine } from "./profitability.engine";
import { ProfitabilityService } from "./profitability.service";

@Module({
  imports: [AuthModule, ConfigClientModule, AiModule],
  controllers: [ProfitabilityController],
  providers: [ProfitabilityEngine, ProfitabilityService],
  exports: [ProfitabilityEngine, ProfitabilityService]
})
export class ProfitabilityModule {}
