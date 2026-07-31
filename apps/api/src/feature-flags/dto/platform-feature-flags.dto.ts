import { IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";

export class DisablePlatformModuleDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userMessageFr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userMessageEn?: string;

  @IsOptional()
  @IsISO8601()
  scheduledReactivation?: string;
}

export class ReactivatePlatformModuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class NotifyModuleReactivationDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Email ou numéro de téléphone du compte à ajouter à l'allow-list. */
export class AddFeatureFlagTestAccountDto {
  @IsString()
  @MaxLength(255)
  identifier!: string;
}
