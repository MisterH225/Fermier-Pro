import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { UpsertTechnicianProfileDto } from "./dto/upsert-technician-profile.dto";
import { TechnicianProfilesService } from "./technician-profiles.service";

@Controller("technicians/me")
@UseGuards(SupabaseJwtGuard)
export class TechnicianProfilesController {
  constructor(private readonly svc: TechnicianProfilesService) {}

  @Get("dashboard")
  dashboard(
    @CurrentUser() user: User,
    @Query("farmId") farmId?: string
  ) {
    return this.svc.dashboard(user, farmId?.trim() || undefined);
  }

  @Get("farms")
  farms(@CurrentUser() user: User) {
    return this.svc.listFarms(user);
  }

  @Get("activity")
  activity(
    @CurrentUser() user: User,
    @Query("farmId") farmId?: string,
    @Query("limit") limit?: string
  ) {
    const n = limit ? Number.parseInt(limit, 10) : 20;
    return this.svc.activity(
      user,
      farmId?.trim() || undefined,
      Number.isFinite(n) ? n : 20
    );
  }

  @Patch("profile")
  upsertProfile(
    @CurrentUser() user: User,
    @Body() dto: UpsertTechnicianProfileDto
  ) {
    return this.svc.upsertMe(user, dto);
  }
}
