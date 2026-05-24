import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { AdminPlatformService } from "./admin-platform.service";
import { AdminAiService } from "./admin-ai.service";
import {
  AdminAiAskDto,
  AdminAiLocaleDto,
  CreateSanitaryAlertDto,
  RejectVetProfileAdminDto,
  UpdatePlatformSettingsDto
} from "./dto/admin-platform.dto";
import { SuperAdminGuard } from "./super-admin.guard";

@Controller("admin")
@UseGuards(SupabaseJwtGuard, SuperAdminGuard)
export class AdminPlatformController {
  constructor(
    private readonly admin: AdminPlatformService,
    private readonly adminAi: AdminAiService
  ) {}

  @Get("me")
  me(@CurrentUser() user: User) {
    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: "superadmin" as const
    };
  }

  @Get("platform/overview")
  overview() {
    return this.admin.getOverview();
  }

  @Get("vet-profiles")
  listVets(@Query("status") status?: string) {
    return this.admin.listVetProfiles(status);
  }

  @Get("vet-profiles/:id")
  getVet(@Param("id") id: string) {
    return this.admin.getVetProfile(id);
  }

  @Post("vet-profiles/:id/verify")
  verifyVet(@Param("id") id: string) {
    return this.admin.verifyVetProfile(id);
  }

  @Post("vet-profiles/:id/reject")
  rejectVet(@Param("id") id: string, @Body() dto: RejectVetProfileAdminDto) {
    return this.admin.rejectVetProfile(id, dto.reason);
  }

  @Get("users")
  listUsers(
    @Query("search") search?: string,
    @Query("profileType") profileType?: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string
  ) {
    return this.admin.listUsers({
      search,
      profileType,
      skip: skip ? Number.parseInt(skip, 10) : undefined,
      take: take ? Number.parseInt(take, 10) : undefined
    });
  }

  @Get("users/:id")
  getUser(@Param("id") id: string) {
    return this.admin.getUserDetail(id);
  }

  @Get("health-map")
  healthMap(@Query("periodDays") periodDays?: string) {
    const days = periodDays ? Number.parseInt(periodDays, 10) : 30;
    return this.admin.getHealthMap(Number.isFinite(days) ? days : 30);
  }

  @Get("stats")
  stats(@Query("period") period?: "month" | "quarter" | "year") {
    return this.admin.getStats(period ?? "month");
  }

  @Get("settings")
  settings() {
    return this.admin.getSettings();
  }

  @Patch("settings")
  updateSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.admin.updateSettings(dto);
  }

  @Get("sanitary-alerts")
  sanitaryAlerts(@Query("all") all?: string) {
    return this.admin.listSanitaryAlerts(all !== "true");
  }

  @Post("sanitary-alerts")
  createAlert(@CurrentUser() user: User, @Body() dto: CreateSanitaryAlertDto) {
    return this.admin.createSanitaryAlert(user, dto);
  }

  @Get("superadmins")
  superAdmins() {
    return this.admin.listSuperAdmins();
  }

  @Post("ai/epidemic-analysis")
  aiEpidemic(@Body() dto: AdminAiLocaleDto) {
    return this.adminAi.epidemicAnalysis(dto.locale ?? "fr");
  }

  @Post("ai/ask")
  aiAsk(@Body() dto: AdminAiAskDto) {
    return this.adminAi.ask(dto.question, dto.locale ?? "fr");
  }

  @Post("ai/vet-assist/:id")
  aiVetAssist(@Param("id") id: string, @Body() dto: AdminAiLocaleDto) {
    return this.adminAi.vetAssist(id, dto.locale ?? "fr");
  }
}
