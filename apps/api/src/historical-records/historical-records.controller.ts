import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { User } from "@prisma/client";
import { memoryStorage } from "multer";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { FeatureEnabledGuard } from "../config-client/feature-enabled.guard";
import { RequireFeature } from "../config-client/require-feature.decorator";
import { ConfirmHistoricalImportDto } from "./dto/confirm-historical-import.dto";
import { CreateQuickTotalDto } from "./dto/create-quick-total.dto";
import { HistoricalImportService } from "./historical-import.service";
import { HistoricalRecordsService } from "./historical-records.service";

@Controller("farms/:farmId/historical-records")
@RequireFeature("finance")
@UseGuards(SupabaseJwtGuard, FeatureEnabledGuard, FarmScopesGuard)
export class HistoricalRecordsController {
  constructor(
    private readonly service: HistoricalRecordsService,
    private readonly importService: HistoricalImportService
  ) {}

  @Post("quick-total")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  createQuickTotal(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateQuickTotalDto
  ) {
    return this.service.createQuickTotal(user, farmId, dto);
  }

  @Post("import/preview")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  previewImport(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Fichier requis");
    }
    return this.importService.parseFile(file.buffer, file.originalname);
  }

  @Post("import/confirm")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  confirmImport(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: ConfirmHistoricalImportDto
  ) {
    return this.importService.confirmImport(user, farmId, dto);
  }

  @Get("summary")
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  getSummary(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.service.getSummary(user, farmId);
  }

  @Get()
  @RequireFarmScopes(FARM_SCOPE.financeRead)
  listRecords(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.service.listRecords(user, farmId);
  }

  @Delete("batch/:batchId")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  deleteBatch(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("batchId") batchId: string
  ) {
    return this.service.deleteImportBatch(user, farmId, batchId);
  }

  @Delete(":id")
  @RequireFarmScopes(FARM_SCOPE.financeWrite)
  deleteRecord(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("id") id: string
  ) {
    return this.service.deleteRecord(user, farmId, id);
  }
}
