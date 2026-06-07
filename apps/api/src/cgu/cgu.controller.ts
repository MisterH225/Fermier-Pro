import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { AcceptCguDto } from "./dto/accept-cgu.dto";
import { CguService } from "./cgu.service";

@Controller()
export class CguController {
  constructor(private readonly cgu: CguService) {}

  @Get("cgu/current")
  getCurrent() {
    return this.cgu.getCurrent();
  }

  @Get("users/:userId/cgu-status")
  @UseGuards(SupabaseJwtGuard)
  async userCguStatus(
    @CurrentUser() user: User,
    @Param("userId") userId: string
  ) {
    if (user.id !== userId) {
      throw new ForbiddenException();
    }
    return this.cgu.getStatusForUser(userId);
  }

  @Post("users/:userId/accept-cgu")
  @UseGuards(SupabaseJwtGuard)
  acceptForUser(
    @CurrentUser() user: User,
    @Param("userId") userId: string,
    @Body() dto: AcceptCguDto
  ) {
    if (user.id !== userId) {
      throw new ForbiddenException();
    }
    return this.cgu.acceptCgu(userId, dto.version);
  }
}
