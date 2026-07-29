import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards
} from "@nestjs/common";
import { TrustScoreProfileType, type User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { TrustScoreService } from "./trust-score.service";

const PROFILE_TYPES = new Set<string>(Object.values(TrustScoreProfileType));

function parseProfileType(raw?: string): TrustScoreProfileType {
  const profileType = (raw ?? "producer").trim();
  if (!PROFILE_TYPES.has(profileType)) {
    throw new BadRequestException(
      `profileType invalide (attendu: ${[...PROFILE_TYPES].join("|")})`
    );
  }
  return profileType as TrustScoreProfileType;
}

@Controller("trust-score")
@UseGuards(SupabaseJwtGuard)
export class TrustScoreController {
  constructor(private readonly trustScore: TrustScoreService) {}

  /**
   * Score de confiance v2 explicable (mode ombre par défaut).
   * GET /api/v1/trust-score/me?profileType=producer
   * Visibilité « self » : tous les piliers + preuves + conseils.
   */
  @Get("me")
  getMine(
    @CurrentUser() user: User,
    @Query("profileType") profileTypeRaw?: string
  ) {
    return this.trustScore.getMe(user.id, parseProfileType(profileTypeRaw));
  }

  /**
   * Vue contrepartie en transaction.
   * GET /api/v1/trust-score/counterpart/:userId?profileType=buyer
   */
  @Get("counterpart/:userId")
  getCounterpart(
    @Param("userId") userId: string,
    @Query("profileType") profileTypeRaw?: string
  ) {
    return this.trustScore.getCounterpart(
      userId,
      parseProfileType(profileTypeRaw)
    );
  }

  /**
   * Consultation publique : niveau + moyenne/nombre d'avis.
   * GET /api/v1/trust-score/public/:userId?profileType=merchant
   */
  @Get("public/:userId")
  getPublic(
    @Param("userId") userId: string,
    @Query("profileType") profileTypeRaw?: string
  ) {
    return this.trustScore.getPublic(userId, parseProfileType(profileTypeRaw));
  }
}
