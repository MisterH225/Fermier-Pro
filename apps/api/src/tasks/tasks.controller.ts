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
import { TaskStatus } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TasksService } from "./tasks.service";

@Controller("farms/:farmId/tasks")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequireFarmScopes(FARM_SCOPE.tasksRead)
  list(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("status") status?: TaskStatus
  ) {
    return this.tasks.list(user, farmId, status);
  }

  @Post()
  @RequireFarmScopes(FARM_SCOPE.tasksWrite)
  create(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateTaskDto
  ) {
    return this.tasks.create(user, farmId, dto);
  }

  @Patch(":taskId")
  @RequireFarmScopes(FARM_SCOPE.tasksWrite)
  update(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("taskId") taskId: string,
    @Body() dto: UpdateTaskDto
  ) {
    return this.tasks.update(user, farmId, taskId, dto);
  }

  @Delete(":taskId")
  @RequireFarmScopes(FARM_SCOPE.tasksWrite)
  async remove(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("taskId") taskId: string
  ) {
    await this.tasks.remove(user, farmId, taskId);
    return { ok: true };
  }
}
