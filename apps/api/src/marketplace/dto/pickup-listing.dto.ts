import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

/** Date de rendez-vous pour le retrait des animaux (hors paiement in-app). */
export class PickupListingDto {
  @IsOptional()
  @IsDateString()
  pickupAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  pickupNote?: string | null;
}
