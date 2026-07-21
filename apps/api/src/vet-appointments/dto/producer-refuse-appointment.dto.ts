import { IsOptional, IsString, MaxLength } from "class-validator";

export class ProducerRefuseAppointmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  refusalReason?: string;
}
