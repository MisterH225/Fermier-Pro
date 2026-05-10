import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigClientModule } from "../config-client/config-client.module";
import { VetConsultationsController } from "./vet-consultations.controller";
import { VetConsultationsService } from "./vet-consultations.service";

@Module({
  imports: [AuthModule, ConfigClientModule],
  controllers: [VetConsultationsController],
  providers: [VetConsultationsService]
})
export class VetConsultationsModule {}
