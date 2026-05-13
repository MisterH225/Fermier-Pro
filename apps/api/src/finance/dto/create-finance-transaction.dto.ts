import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreateFinanceTransactionDto {
  @IsIn(["income", "expense"])
  type!: "income" | "expense";

  @IsOptional()
  @IsString()
  @MaxLength(40)
  financeCategoryId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e12)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsString()
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  linkedEntityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  linkedEntityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  attachmentUrl?: string;
}
