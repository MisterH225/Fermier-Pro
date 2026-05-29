import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TechnicianProfilesController } from "./technician-profiles.controller";
import { TechnicianProfilesService } from "./technician-profiles.service";

@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  controllers: [TechnicianProfilesController],
  providers: [TechnicianProfilesService],
  exports: [TechnicianProfilesService]
})
export class TechnicianProfilesModule {}
