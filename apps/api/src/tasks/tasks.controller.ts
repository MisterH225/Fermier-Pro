import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { TaskStatus } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateTaskDto } from "./dto/create-task.dto";
import { ListTasksQueryDto } from "./dto/list-tasks-query.dto";
import { PatchTaskStatusDto } from "./dto/patch-task-status.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TasksService } from "./tasks.service";

@Controller("farms/:farmId/tasks")
@RequireFeature("tasks")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard, FarmScopesGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequireFarmScopes(FARM_SCOPE.tasksRead)
  list(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query() query: ListTasksQueryDto
  ) {
    return this.tasks.list(user, farmId, query);
  }

  @Get("summary")
  @RequireFarmScopes(FARM_SCOPE.tasksRead)
  summary(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.tasks.pendingCount(user, farmId);
  }

  @Get("my-dashboard")
  @RequireFarmScopes(FARM_SCOPE.tasksRead)
  myDashboard(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("period") period?: string
  ) {
    return this.tasks.listMyDashboard(user, farmId, period);
  }

  @Get(":taskId")
  @RequireFarmScopes(FARM_SCOPE.tasksRead)
  getOne(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("taskId") taskId: string
  ) {
    return this.tasks.getOne(user, farmId, taskId);
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

  @Put(":taskId")
  @RequireFarmScopes(FARM_SCOPE.tasksWrite)
  put(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("taskId") taskId: string,
    @Body() dto: UpdateTaskDto
  ) {
    return this.tasks.update(user, farmId, taskId, dto);
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

  @Patch(":taskId/status")
  @RequireFarmScopes(FARM_SCOPE.tasksWrite)
  patchStatus(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("taskId") taskId: string,
    @Body() dto: PatchTaskStatusDto
  ) {
    const status =
      (dto.status as string) === "pending" ? TaskStatus.todo : dto.status;
    return this.tasks.patchStatus(user, farmId, taskId, status);
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
