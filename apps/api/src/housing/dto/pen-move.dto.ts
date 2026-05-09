import { IsOptional, IsString, MaxLength } from "class-validator";

export class PenMoveDto {
  @IsString()
  toPenId!: string;

  @IsOptional()
  @IsString()
  fromPenId?: string;

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
