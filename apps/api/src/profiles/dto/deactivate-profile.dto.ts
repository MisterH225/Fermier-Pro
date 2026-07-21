import { IsOptional, IsString, MaxLength } from "class-validator";

export class DeactivateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
