import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { SmartAlertsModule } from "../smart-alerts/smart-alerts.module";
import { BarnsController } from "./barns.controller";
import { HousingMoveController } from "./housing-move.controller";
import { HousingService } from "./housing.service";
import { PenAllocationService } from "./pen-allocation.service";
import { AdminPenAllocationController } from "./admin-pen-allocation.controller";
import { PenDetailController } from "./pen-detail.controller";
import { PensController } from "./pens.controller";

@Module({
  imports: [AuthModule, ConfigClientModule, forwardRef(() => SmartAlertsModule)],
  controllers: [
    BarnsController,
    PensController,
    PenDetailController,
    HousingMoveController,
    AdminPenAllocationController
  ],
  providers: [HousingService, PenAllocationService],
  exports: [HousingService, PenAllocationService]
})
export class HousingModule {}
