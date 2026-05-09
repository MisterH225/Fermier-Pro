import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ProfilesService } from "./profiles.service";

@Controller("profiles")
@UseGuards(SupabaseJwtGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateProfileDto) {
    return this.profiles.create(user, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateProfileDto
  ) {
    return this.profiles.update(user, id, dto);
  }

  @Delete(":id")
  async remove(@CurrentUser() user: User, @Param("id") id: string) {
    await this.profiles.remove(user, id);
    return { ok: true };
  }
}
