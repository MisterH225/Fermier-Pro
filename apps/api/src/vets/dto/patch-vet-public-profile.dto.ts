import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

/** Mise à jour partielle du profil public (sans reset de vérification). */
export class PatchVetPublicProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  primarySpecialty?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  otherSpecialties?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locationCity?: string;

  @IsOptional()
  @IsBoolean()
  availability?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  interventionRadiusKm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  profilePhotoUrl?: string;
}
