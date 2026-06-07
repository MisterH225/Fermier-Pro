import { IsOptional, IsString, MaxLength } from "class-validator";

export class VetRefuseAppointmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  refusalReason?: string;
}
