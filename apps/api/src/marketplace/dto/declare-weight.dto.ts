import { IsNumber, IsOptional, IsUrl, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

export class DeclareWeightDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100_000)
  realWeightKg!: number;

  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2000)
  photoUrl?: string;
}
