import { Type } from "class-transformer";
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";
import {
  INVITATION_RECIPIENT_KINDS,
  type InvitationRecipientKind,
  InvitationPermissionsDto
} from "./create-farm-invitation.dto";

/**
 * Invitation ciblée d'un compte existant trouvé via la recherche par
 * identifiant. Le destinataire est désigné par son `userId` (et non par
 * l'identifiant brut) pour éviter toute fuite côté requête.
 */
export class InviteByIdentifierDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsIn(INVITATION_RECIPIENT_KINDS as readonly string[])
  recipientKind!: InvitationRecipientKind;

  @IsObject()
  @ValidateNested()
  @Type(() => InvitationPermissionsDto)
  permissions!: InvitationPermissionsDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
