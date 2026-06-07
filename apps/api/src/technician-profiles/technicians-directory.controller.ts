import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { SearchTechniciansQueryDto } from "./dto/search-technicians.dto";
import { TechnicianProfilesService } from "./technician-profiles.service";

@Controller("technicians")
@UseGuards(SupabaseJwtGuard)
export class TechniciansDirectoryController {
  constructor(private readonly svc: TechnicianProfilesService) {}

  @Get("search")
  search(
    @CurrentUser() user: User,
    @Query() query: SearchTechniciansQueryDto
  ) {
    return this.svc.searchPublic(user, query);
  }

  @Get(":userId/public-profile")
  publicProfile(
    @CurrentUser() user: User,
    @Param("userId") userId: string
  ) {
    return this.svc.getPublicProfile(user, userId);
  }
}
