import { IsOptional, IsString, MaxLength } from "class-validator";

export class DisputeWeightDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
