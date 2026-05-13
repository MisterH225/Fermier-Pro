import { MembershipRole } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from "class-validator";

/** Permissions UI mappées vers `scopes` côté serveur. */
export class InvitationPermissionsDto {
  @IsOptional()
  @IsBoolean()
  readOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  dataEntry?: boolean;

  @IsOptional()
  @IsBoolean()
  health?: boolean;

  @IsOptional()
  @IsBoolean()
  finance?: boolean;
}

/** Étiquettes UI mobile (mappées vers `MembershipRole` côté serveur si rôle non fourni). */
export const INVITATION_RECIPIENT_KINDS = [
  "veterinarian",
  "technician",
  "partner"
] as const;
export type InvitationRecipientKind =
  (typeof INVITATION_RECIPIENT_KINDS)[number];

export class CreateFarmInvitationDto {
  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;

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

  @IsOptional()
  @IsIn(INVITATION_RECIPIENT_KINDS as readonly string[])
  recipientKind?: InvitationRecipientKind;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => InvitationPermissionsDto)
  permissions?: InvitationPermissionsDto;
}
