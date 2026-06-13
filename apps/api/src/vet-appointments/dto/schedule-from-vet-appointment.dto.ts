import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";
import { VetVisitReason } from "../../vets/dto/schedule-vet-visit.dto";

export class ScheduleFromVetAppointmentDto {
  @IsISO8601()
  scheduledAt!: string;

  @IsEnum(VetVisitReason)
  reason!: VetVisitReason;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consultationPrice?: number;
}
