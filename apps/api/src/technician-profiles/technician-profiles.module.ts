import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../common/common.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TechnicianProfilesController } from "./technician-profiles.controller";
import { TechniciansDirectoryController } from "./technicians-directory.controller";
import { TechnicianProfilesService } from "./technician-profiles.service";

@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  controllers: [TechnicianProfilesController, TechniciansDirectoryController],
  providers: [TechnicianProfilesService],
  exports: [TechnicianProfilesService]
})
export class TechnicianProfilesModule {}
