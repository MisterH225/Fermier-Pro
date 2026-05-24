import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export class UpsertVetProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  orderNumber!: string;

  @IsString()
  @MaxLength(64)
  primarySpecialty!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  otherSpecialties?: string[];

  @IsString()
  @MaxLength(120)
  locationCity!: string;

  @IsString()
  @MaxLength(120)
  locationCountry!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  professionalPhone!: string;

  @IsString()
  @MaxLength(200)
  schoolName!: string;

  @IsString()
  @MaxLength(120)
  schoolCountry!: string;

  @IsInt()
  @Min(1950)
  @Max(2100)
  graduationYear!: number;

  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  diplomaPhotoUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  profilePhotoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @IsBoolean()
  availability?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  interventionRadiusKm?: number;
}
