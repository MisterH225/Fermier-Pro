import { IsOptional, IsString } from "class-validator";

export class EndPenPlacementDto {
  @IsOptional()
  @IsString()
  animalId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;
}
