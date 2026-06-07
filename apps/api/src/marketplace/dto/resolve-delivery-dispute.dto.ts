import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";
import { MarketplaceDeliveryDisputeStatus } from "@prisma/client";

const RESOLVABLE_OUTCOMES = [
  MarketplaceDeliveryDisputeStatus.resolved_vendor,
  MarketplaceDeliveryDisputeStatus.resolved_buyer,
  MarketplaceDeliveryDisputeStatus.resolved_split,
  MarketplaceDeliveryDisputeStatus.cancelled
] as const;

export type DeliveryDisputeResolutionOutcome =
  (typeof RESOLVABLE_OUTCOMES)[number];

export class ResolveDeliveryDisputeDto {
  @IsEnum(RESOLVABLE_OUTCOMES)
  outcome!: DeliveryDisputeResolutionOutcome;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Part remboursée à l'acheteur (0–100), pour `resolved_split` uniquement. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  buyerRefundPercent?: number;
}
