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
import { VetConsultationStatus } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { RequireFarmScopes } from "../common/decorators/require-farm-scopes.decorator";
import { FarmScopesGuard } from "../common/guards/farm-scopes.guard";
import { CreateConsultationAttachmentDto } from "./dto/create-consultation-attachment.dto";
import { CreateVetConsultationDto } from "./dto/create-vet-consultation.dto";
import { UpdateVetConsultationDto } from "./dto/update-vet-consultation.dto";
import { VetConsultationsService } from "./vet-consultations.service";

@Controller("farms/:farmId/vet-consultations")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class VetConsultationsController {
  constructor(private readonly consultations: VetConsultationsService) {}

  @Get()
  @RequireFarmScopes(FARM_SCOPE.vetRead)
  list(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Query("status") statusRaw?: string
  ) {
    const status =
      statusRaw &&
      Object.values(VetConsultationStatus).includes(
        statusRaw as VetConsultationStatus
      )
        ? (statusRaw as VetConsultationStatus)
        : undefined;
    return this.consultations.list(user, farmId, status);
  }

  @Post()
  @RequireFarmScopes(FARM_SCOPE.vetWrite)
  create(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateVetConsultationDto
  ) {
    return this.consultations.create(user, farmId, dto);
  }

  @Get(":id")
  @RequireFarmScopes(FARM_SCOPE.vetRead)
  one(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("id") id: string
  ) {
    return this.consultations.getOne(user, farmId, id);
  }

  @Patch(":id")
  @RequireFarmScopes(FARM_SCOPE.vetWrite)
  update(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("id") id: string,
    @Body() dto: UpdateVetConsultationDto
  ) {
    return this.consultations.update(user, farmId, id, dto);
  }

  @Post(":id/attachments")
  @RequireFarmScopes(FARM_SCOPE.vetWrite)
  addAttachment(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("id") id: string,
    @Body() dto: CreateConsultationAttachmentDto
  ) {
    return this.consultations.addAttachment(user, farmId, id, dto);
  }
}
