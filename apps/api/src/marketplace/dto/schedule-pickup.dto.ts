import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class SchedulePickupDto {
  @IsDateString()
  pickupDate!: string;

  @IsString()
  @MaxLength(500)
  pickupLocation!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
