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

export class InviteFromChatDto {
  @IsString()
  @MinLength(1)
  peerUserId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  roomId?: string;

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
