import { Type } from "class-transformer";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf
} from "class-validator";

/** Corps PATCH /auth/me/profile — champs optionnels (whitelist). */
export class UpdateMeProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  producerHomeFarmName?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  homeLatitude?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  homeLongitude?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  homeLocationLabel?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(["gps", "manual"])
  homeLocationSource?: "gps" | "manual" | null;
}
