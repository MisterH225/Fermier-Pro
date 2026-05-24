import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminVetsController } from "./admin-vets.controller";
import { VetsController } from "./vets.controller";
import { VetsService } from "./vets.service";

@Module({
  imports: [AuthModule, CommonModule, PrismaModule, ConfigModule],
  controllers: [VetsController, AdminVetsController],
  providers: [VetsService],
  exports: [VetsService]
})
export class VetsModule {}
