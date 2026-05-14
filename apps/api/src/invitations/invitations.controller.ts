import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { CreateFarmInvitationDto } from "./dto/create-farm-invitation.dto";
import { RespondInvitationDto } from "./dto/respond-invitation.dto";
import { InvitationsService } from "./invitations.service";

@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  /** Liste invitations + demandes scan_request en attente (gestionnaires). */
  @Get("farms/:farmId/invitations")
  @UseGuards(SupabaseJwtGuard, FarmScopesGuard)
  @RequireFarmScopes(FARM_SCOPE.invitationsManage)
  listPending(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string
  ) {
    return this.invitations.listPendingInvitations(user, farmId);
  }

  /** Crée un share_link scopé (rôle + permissions UI). */
  @Post("farms/:farmId/invitations")
  @UseGuards(SupabaseJwtGuard, FarmScopesGuard)
  @RequireFarmScopes(FARM_SCOPE.invitationsManage)
  create(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateFarmInvitationDto
  ) {
    return this.invitations.createInvitation(user, farmId, dto);
  }

  /** Récupère / regénère si nécessaire le lien collaboratif par défaut. */
  @Get("farms/:farmId/invitations/default")
  @UseGuards(SupabaseJwtGuard, FarmScopesGuard)
  @RequireFarmScopes(FARM_SCOPE.invitationsManage)
  ensureDefault(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string
  ) {
    return this.invitations.ensureDefaultInvitation(user, farmId);
  }

  /**
   * Aperçu authentifié d'un token : utilisé après scan QR / deep link.
   * Crée une demande `scan_request` si le scanner n'est ni propriétaire ni membre.
   */
  @Get("invitations/by-token/:token")
  @UseGuards(SupabaseJwtGuard)
  preview(
    @CurrentUser() user: User,
    @Param("token") token: string
  ) {
    return this.invitations.previewInvitationByToken(user, token);
  }

  /** Réponse owner à une demande scan_request (ou refus d'un share_link). */
  @Post("invitations/:invitationId/respond")
  @UseGuards(SupabaseJwtGuard)
  respond(
    @CurrentUser() user: User,
    @Param("invitationId") invitationId: string,
    @Body() dto: RespondInvitationDto
  ) {
    return this.invitations.respondToInvitation(user, invitationId, dto);
  }

  /** Flux historique : utilisateur accepte directement un share_link déjà scopé. */
  @Post("invitations/accept")
  @UseGuards(SupabaseJwtGuard)
  accept(@CurrentUser() user: User, @Body() dto: AcceptInvitationDto) {
    return this.invitations.accept(user, dto);
  }

  /**
   * Invalide l'ancien lien par défaut et en génère un nouveau (token frais).
   * Utilisé depuis l'écran Collaboration → « Regénérer le lien ».
   */
  @Post("farms/:farmId/invitations/regenerate")
  @UseGuards(SupabaseJwtGuard, FarmScopesGuard)
  @RequireFarmScopes(FARM_SCOPE.invitationsManage)
  regenerateDefault(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string
  ) {
    return this.invitations.regenerateDefaultInvitation(user, farmId);
  }
}
