import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { BudgetCreatedFrom } from "@prisma/client";

export class BudgetLineInputDto {
  @IsString()
  categoryId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPlanned!: number;
}

export class UpsertFarmBudgetDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetLineInputDto)
  lines!: BudgetLineInputDto[];

  @IsOptional()
  @IsEnum(BudgetCreatedFrom)
  createdFrom?: BudgetCreatedFrom;
}

export class UpdateBudgetLineDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPlanned!: number;
}

export class BudgetMonthQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

export class BudgetSimulateQueryDto extends BudgetMonthQueryDto {
  @IsString()
  categoryId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  newAmount!: number;
}

export class PatchBudgetSuggestionDto {
  @IsOptional()
  apply?: boolean;

  @IsOptional()
  dismiss?: boolean;
}
