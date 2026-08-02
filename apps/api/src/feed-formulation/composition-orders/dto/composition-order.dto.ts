import { MarketplacePaymentMethod } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf
} from "class-validator";

export class CreateCompositionOrderDto {
  @IsString()
  @MinLength(1)
  millProfileId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  radiusKm?: number;
}

export class ReviseCompositionOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  millNote?: string;

  /** Substitution : retire cet intrant (obligatoire si addIngredientId). */
  @ValidateIf((o: ReviseCompositionOrderDto) => Boolean(o.addIngredientId))
  @IsString()
  @MinLength(1)
  removeIngredientId?: string;

  /** Substitution : ajoute cet intrant (passe par recomputeWithSubstitution). */
  @ValidateIf((o: ReviseCompositionOrderDto) => Boolean(o.removeIngredientId))
  @IsString()
  @MinLength(1)
  addIngredientId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  addPricePerKg?: number;

  /** Obligatoire — estimation lancement production. */
  @IsDateString()
  productionStartEstimate!: string;

  /** Obligatoire — estimation disponibilité ( ≥ productionStartEstimate ). */
  @IsDateString()
  readyEstimate!: string;
}

export class UpdateReadyEstimateDto {
  @IsDateString()
  readyEstimate!: string;
}

export class PayCompositionOrderDto {
  @IsOptional()
  @IsEnum(MarketplacePaymentMethod)
  paymentMethod?: MarketplacePaymentMethod;
}

export class ConfirmCompositionPaymentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  providerRef?: string;
}

/** Moulin : démarre une livraison autogérée (flag delivery). */
export class MarkOutForDeliveryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feeXof!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class OpenCompositionOrderDisputeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

export class ResolveCompositionOrderDisputeDto {
  @IsIn(["mill", "producer"])
  decision!: "mill" | "producer";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
