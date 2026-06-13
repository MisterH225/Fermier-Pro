import { IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

export class RequestVetAppointmentDto {
  @IsString()
  vetProfileId!: string;

  @IsISO8601()
  scheduledAt!: string;

  @IsString()
  @MaxLength(64)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(12)
  estimatedDurationHours?: number;
}
