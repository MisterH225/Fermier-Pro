import { IsBoolean } from "class-validator";

/** Réponse invité à une invitation reçue (`accept=true` → membership). */
export class RespondMyInvitationDto {
  @IsBoolean()
  accept!: boolean;
}
