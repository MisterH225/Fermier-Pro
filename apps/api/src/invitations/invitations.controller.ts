import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { CreateFarmInvitationDto } from "./dto/create-farm-invitation.dto";
import { InvitationsService } from "./invitations.service";

@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

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

  @Post("invitations/accept")
  @UseGuards(SupabaseJwtGuard)
  accept(@CurrentUser() user: User, @Body() dto: AcceptInvitationDto) {
    return this.invitations.accept(user, dto);
  }
}
