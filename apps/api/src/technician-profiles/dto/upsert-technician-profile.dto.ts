import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

export class UpsertTechnicianProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  experienceYears?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  specializations?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  formation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  profilePhotoUrl?: string;

  @IsOptional()
  @IsBoolean()
  onboardingComplete?: boolean;
}
