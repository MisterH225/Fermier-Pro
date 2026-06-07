import { Module } from "@nestjs/common";
import { AgeCalculationService } from "./age-calculation.service";

@Module({
  providers: [AgeCalculationService],
  exports: [AgeCalculationService]
})
export class AgeCalculationModule {}
