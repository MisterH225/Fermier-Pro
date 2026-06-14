import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { FeedTypeUnit } from "@prisma/client";
import { CreateFeedTypeDto } from "../../feed-stock/dto/create-feed-type.dto";

export class StockLineInputDto {
  @IsOptional()
  @IsString()
  feedTypeId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateFeedTypeDto)
  newFeedType?: CreateFeedTypeDto;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000_001)
  @Max(1e9)
  quantityInput!: number;

  @IsOptional()
  @IsEnum(FeedTypeUnit)
  quantityUnit?: FeedTypeUnit;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(500)
  weightPerBagKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e9)
  unitPrice?: number;

  @IsOptional()
  @IsEnum(["kg", "sac"] as const)
  priceBasis?: "kg" | "sac";

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supplier?: string;
}

export class CreateTransactionWithStockDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsString()
  @MaxLength(500)
  label!: string;

  @IsOptional()
  @IsString()
  financeCategoryId?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsBoolean()
  recordStock?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockLineInputDto)
  stockLines?: StockLineInputDto[];
}

export class CreateMovementWithTransactionDto {
  @IsEnum(["in", "stock_check"] as const)
  kind!: "in" | "stock_check";

  @IsOptional()
  @IsString()
  feedTypeId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateFeedTypeDto)
  newFeedType?: CreateFeedTypeDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantityInput?: number;

  @IsOptional()
  @IsEnum(FeedTypeUnit)
  quantityUnit?: FeedTypeUnit;

  @IsOptional()
  @Type(() => Number)
  weightPerBagKg?: number;

  @IsOptional()
  @Type(() => Number)
  bagsCounted?: number;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @Type(() => Number)
  unitPrice?: number;

  @IsOptional()
  @IsEnum(["kg", "sac"] as const)
  priceBasis?: "kg" | "sac";

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsBoolean()
  createFinanceExpense?: boolean;

  @IsOptional()
  @IsString()
  financeLabel?: string;
}

export class SyncLinkedStockDto {
  @IsOptional()
  @IsBoolean()
  syncUnitPrices?: boolean;
}

export class DeleteWithStockQueryDto {
  @IsOptional()
  @IsBoolean()
  deleteStock?: boolean;
}
