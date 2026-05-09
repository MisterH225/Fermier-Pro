import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { VetConsultationsController } from "./vet-consultations.controller";
import { VetConsultationsService } from "./vet-consultations.service";

@Module({
  imports: [AuthModule],
  controllers: [VetConsultationsController],
  providers: [VetConsultationsService]
})
export class VetConsultationsModule {}
