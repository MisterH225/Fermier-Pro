import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Res,
  UseGuards
} from "@nestjs/common";
import type { Response } from "express";
import { setDeprecatedSuccessor } from "../common/http/deprecation.util";
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
    @Param("userId") userId: string,
    @Res({ passthrough: true }) res: Response
  ) {
    if (user.id !== userId) {
      throw new ForbiddenException();
    }
    setDeprecatedSuccessor(res, "/api/v1/auth/me/cgu-status");
    return this.cgu.getStatusForUser(userId);
  }

  @Post("users/:userId/accept-cgu")
  @UseGuards(SupabaseJwtGuard)
  acceptForUser(
    @CurrentUser() user: User,
    @Param("userId") userId: string,
    @Body() dto: AcceptCguDto,
    @Res({ passthrough: true }) res: Response
  ) {
    if (user.id !== userId) {
      throw new ForbiddenException();
    }
    setDeprecatedSuccessor(res, "/api/v1/auth/me/accept-cgu");
    return this.cgu.acceptCgu(userId, dto.version);
  }
}
