import { MembershipRole } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  ValidateNested
} from "class-validator";
import { InvitationPermissionsDto } from "./create-farm-invitation.dto";

/**
 * Réponse owner à une demande `scan_request` :
 * `accept=true` → rôle + permissions obligatoires (création membership).
 * `accept=false` → demande passe en `rejected`.
 */
export class RespondInvitationDto {
  @IsBoolean()
  accept!: boolean;

  @IsOptional()
  @IsEnum(MembershipRole)
  recipientRole?: MembershipRole;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => InvitationPermissionsDto)
  permissions?: InvitationPermissionsDto;
}
