import { IsString, MaxLength, MinLength } from "class-validator";

/**
 * Saisie utilisateur libre — la distinction email vs téléphone est faite
 * côté service via `detectIdentifierKind`.
 */
export class SearchCollaboratorDto {
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  identifier!: string;
}
