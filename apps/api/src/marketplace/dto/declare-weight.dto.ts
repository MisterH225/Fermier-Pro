import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

export class BuyerAnimalWeightDto {
  @IsString()
  @MaxLength(64)
  animalId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100_000)
  weightKg!: number;

  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2000)
  photoUrl?: string;
}

export class DeclareWeightDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100_000)
  realWeightKg?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BuyerAnimalWeightDto)
  animalWeights?: BuyerAnimalWeightDto[];

  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2000)
  photoUrl?: string;
}

export class DeclareSellerWeightDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100_000)
  sellerDeclaredWeightKg!: number;

  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2000)
  photoUrl?: string;
}
