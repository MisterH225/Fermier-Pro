import { Type } from "class-transformer";
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class ReconcileFeedMovementDto {
  @IsString()
  @MaxLength(40)
  expenseId!: string;
}

export class RejectReconciliationDto {
  @IsString()
  @MaxLength(40)
  expenseId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1e12)
  totalCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supplier?: string;
}
