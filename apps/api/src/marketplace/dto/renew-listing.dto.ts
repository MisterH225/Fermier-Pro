import { Type } from "class-transformer";
import { IsIn, IsInt } from "class-validator";
import { LISTING_DURATION_DAYS } from "./publish-listing.dto";

export class RenewListingDto {
  @Type(() => Number)
  @IsInt()
  @IsIn(LISTING_DURATION_DAYS as unknown as number[])
  durationDays!: (typeof LISTING_DURATION_DAYS)[number];
}
