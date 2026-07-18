import { Controller, Get, UseGuards } from "@nestjs/common";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { TrustScoreService } from "./trust-score.service";

@Controller("admin/trust-score")
@UseGuards(SupabaseJwtGuard, SuperAdminGuard)
export class TrustScoreAdminController {
  constructor(private readonly trustScore: TrustScoreService) {}

  /**
   * Rapport ombre v1 vs v2 (producteurs) — base de décision pour la bascule.
   * Ne modifie aucun score ni l'éligibilité crédit.
   */
  @Get("shadow-report")
  shadowReport() {
    return this.trustScore.buildShadowReport();
  }
}
