import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { FinanceModule } from "../finance/finance.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FarmHealthController } from "./farm-health.controller";
import { FarmHealthService } from "./farm-health.service";

@Module({
  imports: [CommonModule, PrismaModule, FinanceModule],
  controllers: [FarmHealthController],
  providers: [FarmHealthService]
})
export class FarmHealthModule {}
