import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { BarnsController } from "./barns.controller";
import { HousingMoveController } from "./housing-move.controller";
import { HousingService } from "./housing.service";
import { PenDetailController } from "./pen-detail.controller";
import { PensController } from "./pens.controller";

@Module({
  imports: [AuthModule, ConfigClientModule],
  controllers: [
    BarnsController,
    PensController,
    PenDetailController,
    HousingMoveController
  ],
  providers: [HousingService]
})
export class HousingModule {}
