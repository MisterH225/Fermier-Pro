import { MembershipRole } from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

export class CreateFarmInvitationDto {
  @IsEnum(MembershipRole)
  role!: MembershipRole;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  scopes?: string[];

  @IsOptional()
  @IsEmail()
  inviteeEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  inviteePhone?: string;
}
