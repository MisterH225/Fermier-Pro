import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { VetVisitReason } from "./schedule-vet-visit.dto";

export class ProducerScheduleVetVisitDto {
  @IsString()
  vetProfileId!: string;

  @IsISO8601()
  scheduledAt!: string;

  @IsEnum(VetVisitReason)
  reason!: VetVisitReason;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
