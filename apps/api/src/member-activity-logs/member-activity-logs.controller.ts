import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards
} from "@nestjs/common";
import type { MemberActivityModule, User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { MemberActivityLogsService } from "./member-activity-logs.service";

@Controller("farms/:farmId/activity-logs")
@UseGuards(SupabaseJwtGuard)
export class MemberActivityLogsController {
  constructor(private readonly svc: MemberActivityLogsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("member_id") memberId?: string,
    @Query("module") module?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limitRaw?: string
  ) {
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    return this.svc.listForFarm(user, farmId, {
      memberId,
      module: module as MemberActivityModule | undefined,
      cursor,
      limit: Number.isFinite(limit) ? (limit as number) : undefined
    });
  }
}
