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
import { ProducerProfileGuard } from "../../auth/guards/producer-profile.guard";
import { SupabaseJwtGuard } from "../../auth/guards/supabase-jwt.guard";
import { RequirePlatformModule } from "../../feature-flags/require-platform-module.decorator";
import { PlatformModuleEnabledGuard } from "../../feature-flags/platform-module-enabled.guard";
import {
  ApplyCompositionAdjustmentDto,
  AssistFeedCompositionDto,
  ExplainFeedCompositionDto,
  FormulateFeedCompositionDto,
  MillPricesQueryDto,
  ProposeCompositionAdjustmentDto,
  RejectCompositionAdjustmentDto,
  RequestVetReviewDto,
  SaveCompositionDto,
  VetReviewCompositionDto
} from "./dto/feed-composition.dto";
import { CompositionPricingService } from "./composition-pricing.service";
import { FeedCompositionAssistService } from "./feed-composition-assist.service";
import { FeedCompositionExplainService } from "./explain/feed-composition-explain.service";
import { SavedCompositionsService } from "./saved-compositions.service";

/**
 * Endpoints composition d'aliments (flag feed_composition).
 * Clé Gemini serveur-only (`GEMINI_API_KEY`) — jamais exposée au mobile.
 */
@Controller("feed-composition")
@RequirePlatformModule("feed_composition")
@UseGuards(SupabaseJwtGuard, PlatformModuleEnabledGuard)
export class FeedCompositionController {
  constructor(
    private readonly assist: FeedCompositionAssistService,
    private readonly explainService: FeedCompositionExplainService,
    private readonly saved: SavedCompositionsService,
    private readonly pricing: CompositionPricingService
  ) {}

  /** File d'attente véto : compositions en revue sur ses fermes. */
  @Get("vet/pending-reviews")
  listPendingForVet(@CurrentUser() user: User) {
    return this.saved.listPendingForVeterinarian(user);
  }

  /** Recherche catalogue intrants (ajustement véto). */
  @Get("ingredients")
  searchIngredients(
    @CurrentUser() user: User,
    @Query("q") q?: string
  ) {
    return this.saved.searchIngredients(user, q ?? "");
  }

  /** Agent conversationnel (Gemini + function calling → FeedFormulationService). */
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

  /**
   * Explication structurée d'une ration (Gemini, sans function calling).
   * Cache sur SavedComposition.explanation si savedCompositionId fourni.
   */
  @Post("explain")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  explainComposition(
    @CurrentUser() user: User,
    @Body() dto: ExplainFeedCompositionDto
  ) {
    return this.explainService.explain(user, dto);
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

  /**
   * Comparaison de prix multi-moulins (P-J4-A).
   * Réservé au producteur propriétaire / membre autorisé (finance.write).
   */
  @Get("compositions/:id/mill-prices")
  @UseGuards(ProducerProfileGuard)
  listMillPrices(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Query() query: MillPricesQueryDto
  ) {
    return this.pricing.priceForMills(user, id, query.radiusKm);
  }

  @Get("compositions/:id")
  getOne(@CurrentUser() user: User, @Param("id") id: string) {
    return this.saved.getOne(user, id);
  }

  /** Alias chemin court spec P-J4-A : GET /feed-composition/:id/mill-prices */
  @Get(":id/mill-prices")
  @UseGuards(ProducerProfileGuard)
  listMillPricesAlias(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Query() query: MillPricesQueryDto
  ) {
    return this.pricing.priceForMills(user, id, query.radiusKm);
  }

  /** Véto associés (si vide → UI guide vers l'équipe ferme, bouton toujours visible). */
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

  /**
   * Véto : prévisualiser un ajustement (moteur, sans persister).
   * Affiche ration + écart avant confirmation.
   */
  @Post("compositions/:id/vet-adjustment/preview")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  previewVetAdjustment(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: ProposeCompositionAdjustmentDto
  ) {
    return this.saved.previewVetAdjustment(user, id, dto);
  }

  /**
   * Véto : proposer un ajustement recalculé par le moteur + carte dans le fil.
   * Alias : propose-adjustment (compat mobile).
   */
  @Post("compositions/:id/vet-adjustment")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  proposeVetAdjustment(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: ProposeCompositionAdjustmentDto
  ) {
    return this.saved.proposeAdjustment(user, id, dto);
  }

  /** @deprecated préférer POST .../vet-adjustment */
  @Post("compositions/:id/propose-adjustment")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  proposeAdjustment(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: ProposeCompositionAdjustmentDto
  ) {
    return this.saved.proposeAdjustment(user, id, dto);
  }

  /** Producteur : appliquer une proposition (proposalId ou messageId legacy). */
  @Post("compositions/:id/adjustment/:proposalId/apply")
  applyAdjustmentById(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("proposalId") proposalId: string
  ) {
    return this.saved.applyAdjustment(user, id, { proposalId });
  }

  /** Producteur : refuser une proposition. */
  @Post("compositions/:id/adjustment/:proposalId/reject")
  rejectAdjustmentById(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Param("proposalId") proposalId: string,
    @Body() dto: RejectCompositionAdjustmentDto
  ) {
    return this.saved.rejectAdjustment(user, id, proposalId, dto);
  }

  /** @deprecated préférer POST .../adjustment/:proposalId/apply */
  @Post("compositions/:id/apply-adjustment")
  applyAdjustment(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: ApplyCompositionAdjustmentDto
  ) {
    return this.saved.applyAdjustment(user, id, dto);
  }
}
