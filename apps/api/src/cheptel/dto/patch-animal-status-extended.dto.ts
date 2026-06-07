import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { PatchAnimalStatusDto } from "../../livestock/dto/patch-animal-status.dto";

export class PatchAnimalStatusExtendedDto extends PatchAnimalStatusDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e12)
  salePrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  buyerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deathCause?: string;
}
