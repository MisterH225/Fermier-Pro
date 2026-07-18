import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards
} from "@nestjs/common";
import { TrustScoreProfileType, type User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { TrustScoreService } from "./trust-score.service";

const PROFILE_TYPES = new Set<string>(Object.values(TrustScoreProfileType));

@Controller("trust-score")
@UseGuards(SupabaseJwtGuard)
export class TrustScoreController {
  constructor(private readonly trustScore: TrustScoreService) {}

  /**
   * Score de confiance v2 explicable (mode ombre par défaut).
   * GET /api/v1/trust-score/me?profileType=producer
   */
  @Get("me")
  getMine(
    @CurrentUser() user: User,
    @Query("profileType") profileTypeRaw?: string
  ) {
    const profileType = (profileTypeRaw ?? "producer").trim();
    if (!PROFILE_TYPES.has(profileType)) {
      throw new BadRequestException(
        `profileType invalide (attendu: ${[...PROFILE_TYPES].join("|")})`
      );
    }
    return this.trustScore.getMe(
      user.id,
      profileType as TrustScoreProfileType
    );
  }
}
