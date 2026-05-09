import { IsOptional, IsString, MaxLength } from "class-validator";

export class StartPenPlacementDto {
  @IsOptional()
  @IsString()
  animalId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
