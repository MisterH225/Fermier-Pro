import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { FinanceModule } from "../finance/finance.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FarmHealthController } from "./farm-health.controller";
import { FarmHealthService } from "./farm-health.service";
import { FarmVaccineController } from "./farm-vaccine.controller";
import { FarmVaccineService } from "./farm-vaccine.service";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";

@Module({
  imports: [
    AuthModule,
    CommonModule,
    PrismaModule,
    FinanceModule,
    SmartAlertsModule
  ],
  controllers: [FarmHealthController, FarmVaccineController],
  providers: [FarmHealthService, FarmVaccineService]
})
export class FarmHealthModule {}
