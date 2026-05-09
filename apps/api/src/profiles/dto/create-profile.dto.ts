import { ProfileType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateProfileDto {
  @IsEnum(ProfileType)
  type!: ProfileType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;
}
