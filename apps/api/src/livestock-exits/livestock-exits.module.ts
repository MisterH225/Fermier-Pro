import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LivestockExitsController } from "./livestock-exits.controller";
import { LivestockExitsService } from "./livestock-exits.service";

@Module({
  imports: [AuthModule],
  controllers: [LivestockExitsController],
  providers: [LivestockExitsService]
})
export class LivestockExitsModule {}
