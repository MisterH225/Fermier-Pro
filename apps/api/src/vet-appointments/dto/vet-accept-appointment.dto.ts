import { IsISO8601, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

export class VetAcceptAppointmentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  servicePrice!: number;

  @IsOptional()
  @IsISO8601()
  confirmedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
