import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional } from "class-validator";

export const LISTING_DURATION_DAYS = [7, 14, 30] as const;
export type ListingDurationDays = (typeof LISTING_DURATION_DAYS)[number];

export class PublishListingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(LISTING_DURATION_DAYS as unknown as number[])
  durationDays?: ListingDurationDays;
}
