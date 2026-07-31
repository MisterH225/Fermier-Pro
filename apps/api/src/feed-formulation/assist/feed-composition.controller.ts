import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { User } from "@prisma/client";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../../auth/guards/supabase-jwt.guard";
import { RequirePlatformModule } from "../../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../../feature-flags/platform-module-enabled.guard";
import {
  AssistFeedCompositionDto,
  FormulateFeedCompositionDto,
  RequestVetReviewDto,
  SaveCompositionDto,
  VetReviewCompositionDto
} from "./dto/feed-composition.dto";
import { FeedCompositionAssistService } from "./feed-composition-assist.service";
import { SavedCompositionsService } from "./saved-compositions.service";

/**
 * Endpoints composition d'aliments (flag feed_composition).
 * Clé Anthropic serveur-only — jamais exposée au mobile.
 */
@Controller("feed-composition")
@RequirePlatformModule("feed_composition")
@UseGuards(SupabaseJwtGuard, PlatformModuleEnabledGuard)
export class FeedCompositionController {
  constructor(
    private readonly assist: FeedCompositionAssistService,
    private readonly saved: SavedCompositionsService
  ) {}

  /** Agent conversationnel (Anthropic + outils → FeedFormulationService). */
  @Post("assist")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  assistChat(
    @CurrentUser() user: User,
    @Body() dto: AssistFeedCompositionDto
  ) {
    return this.assist.assist(user, dto);
  }

  /**
   * Mode dégradé sans IA — même moteur que l'outil formulate_ration.
   * Le mobile bascule ici si AI_UNAVAILABLE.
   */
  @Post("formulate")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  formulateManual(
    @CurrentUser() user: User,
    @Body() dto: FormulateFeedCompositionDto
  ) {
    return this.assist.formulateManual(user, dto);
  }

  @Post("compositions")
  save(@CurrentUser() user: User, @Body() dto: SaveCompositionDto) {
    return this.saved.save(user, dto);
  }

  @Get("compositions")
  list(
    @CurrentUser() user: User,
    @Query("farmId") farmId: string
  ) {
    return this.saved.listForFarm(user, farmId);
  }

  @Get("compositions/:id")
  getOne(@CurrentUser() user: User, @Param("id") id: string) {
    return this.saved.getOne(user, id);
  }

  /** Véto associés (si vide → UI masque l'option d'envoi). */
  @Get("farms/:farmId/veterinarians")
  listVets(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.saved.listAssociatedVeterinarians(user, farmId);
  }

  @Post("compositions/:id/request-vet-review")
  requestVetReview(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: RequestVetReviewDto
  ) {
    return this.saved.requestVetReview(user, id, dto);
  }

  @Post("compositions/:id/vet-review")
  vetReview(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: VetReviewCompositionDto
  ) {
    return this.saved.vetReview(user, id, dto);
  }
}
