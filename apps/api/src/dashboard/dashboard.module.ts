import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { PrismaModule } from "../prisma/prisma.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [AuthModule, PrismaModule, CommonModule, ConfigClientModule],
  controllers: [DashboardController],
  providers: [DashboardService]
})
export class DashboardModule {}
