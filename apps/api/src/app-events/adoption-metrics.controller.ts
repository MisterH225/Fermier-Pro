import { Controller, Get, UseGuards } from "@nestjs/common";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { AdoptionMetricsService } from "./adoption-metrics.service";

@Controller("admin/metrics")
@UseGuards(SupabaseJwtGuard, SuperAdminGuard)
export class AdoptionMetricsController {
  constructor(private readonly metrics: AdoptionMetricsService) {}

  /** Métriques d'adoption refonte — fenêtres 7 j / 30 j. */
  @Get("adoption")
  adoption() {
    return this.metrics.getAdoptionMetrics();
  }
}
