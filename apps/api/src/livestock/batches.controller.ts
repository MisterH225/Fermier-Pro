import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateHealthEventDto } from "../health-events/dto/create-health-event.dto";
import { BatchesService } from "./batches.service";
import { CreateBatchWeightDto } from "./dto/create-batch-weight.dto";
import { CreateLivestockBatchDto } from "./dto/create-livestock-batch.dto";
import { UpdateLivestockBatchDto } from "./dto/update-livestock-batch.dto";

@Controller("farms/:farmId/batches")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Get()
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  list(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.batches.listBatches(user, farmId);
  }

  @Post()
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  create(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateLivestockBatchDto
  ) {
    return this.batches.createBatch(user, farmId, dto);
  }

  @Get(":batchId")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  one(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("batchId") batchId: string
  ) {
    return this.batches.getBatch(user, farmId, batchId);
  }

  @Patch(":batchId")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  update(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("batchId") batchId: string,
    @Body() dto: UpdateLivestockBatchDto
  ) {
    return this.batches.updateBatch(user, farmId, batchId, dto);
  }

  @Delete(":batchId")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  async remove(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("batchId") batchId: string
  ) {
    await this.batches.deleteBatch(user, farmId, batchId);
    return { ok: true };
  }

  @Post(":batchId/weights")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  addWeight(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("batchId") batchId: string,
    @Body() dto: CreateBatchWeightDto
  ) {
    return this.batches.addWeight(user, farmId, batchId, dto);
  }

  @Get(":batchId/health-events")
  @RequireFarmScopes(FARM_SCOPE.healthRead)
  listHealth(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("batchId") batchId: string
  ) {
    return this.batches.listHealthEvents(user, farmId, batchId);
  }

  @Post(":batchId/health-events")
  @RequireFarmScopes(FARM_SCOPE.healthWrite)
  createHealth(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("batchId") batchId: string,
    @Body() dto: CreateHealthEventDto
  ) {
    return this.batches.createHealthEvent(user, farmId, batchId, dto);
  }
}
