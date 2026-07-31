import { MillIngredientPackaging } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min
} from "class-validator";

export class CreateMillIngredientOfferDto {
  @IsString()
  feedIngredientId!: string;

  @IsNumber()
  @Min(0)
  pricePerUnit!: number;

  @IsEnum(MillIngredientPackaging)
  packaging!: MillIngredientPackaging;

  /** Surcharge du facteur kg ; sinon dérivé du packaging. */
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  unitToKg?: number;

  @IsNumber()
  @Min(0)
  stockQuantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mixingCostPerKg?: number | null;

  @IsOptional()
  @IsBoolean()
  isPubliclyListed?: boolean;
}

export class UpdateMillIngredientOfferDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerUnit?: number;

  @IsOptional()
  @IsEnum(MillIngredientPackaging)
  packaging?: MillIngredientPackaging;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  unitToKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mixingCostPerKg?: number | null;

  @IsOptional()
  @IsBoolean()
  isPubliclyListed?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
