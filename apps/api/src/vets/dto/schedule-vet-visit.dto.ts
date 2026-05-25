import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";

export enum VetVisitReason {
  routine = "routine",
  urgency = "urgency",
  followup = "followup",
  vaccination = "vaccination",
  other = "other"
}

export class ScheduleVetVisitDto {
  @IsString()
  farmId!: string;

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
