import {
  Body,
  Controller,
  Delete,
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
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import {
  CreateFeedIngredientDto,
  ListFeedIngredientsQueryDto,
  UpdateFeedIngredientDto
} from "./dto/feed-ingredient.dto";
import { FeedIngredientsService } from "./feed-ingredients.service";

@Controller("admin/feed-ingredients")
@UseGuards(SupabaseJwtGuard, SuperAdminGuard)
export class AdminFeedIngredientsController {
  constructor(private readonly ingredients: FeedIngredientsService) {}

  @Get()
  list(@Query() query: ListFeedIngredientsQueryDto) {
    return this.ingredients.list({
      q: query.q,
      category: query.category,
      includeInactive: query.includeInactive ?? true
    });
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.ingredients.getById(id);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateFeedIngredientDto
  ) {
    return this.ingredients.create(dto, user.id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateFeedIngredientDto
  ) {
    return this.ingredients.update(id, dto, user.id);
  }

  /** Désactivation soft — conserve l'historique / références. */
  @Delete(":id")
  deactivate(@Param("id") id: string, @CurrentUser() user: User) {
    return this.ingredients.deactivate(id, user.id);
  }
}
