import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { UpdateFarmMemberDto } from "./dto/update-farm-member.dto";
import { FarmMembersService } from "./farm-members.service";

@Controller("farms/:farmId/members")
@UseGuards(SupabaseJwtGuard)
export class FarmMembersController {
  constructor(private readonly members: FarmMembersService) {}

  @Get()
  list(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.members.list(user, farmId);
  }

  @Patch(":membershipId")
  @UseGuards(FarmScopesGuard)
  @RequireFarmScopes(FARM_SCOPE.invitationsManage)
  update(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("membershipId") membershipId: string,
    @Body() dto: UpdateFarmMemberDto
  ) {
    return this.members.update(user, farmId, membershipId, dto);
  }

  @Delete(":membershipId")
  remove(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("membershipId") membershipId: string
  ) {
    return this.members.remove(user, farmId, membershipId);
  }
}
