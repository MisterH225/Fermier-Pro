import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { ProfitabilityModule } from "../profitability/profitability.module";
import { HistoricalImportService } from "./historical-import.service";
import { HistoricalRecordsController } from "./historical-records.controller";
import { HistoricalRecordsService } from "./historical-records.service";

@Module({
  imports: [AuthModule, ConfigClientModule, ProfitabilityModule],
  controllers: [HistoricalRecordsController],
  providers: [HistoricalRecordsService, HistoricalImportService],
  exports: [HistoricalRecordsService, HistoricalImportService]
})
export class HistoricalRecordsModule {}
