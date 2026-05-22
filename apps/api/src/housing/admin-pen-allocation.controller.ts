import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IsOptional, IsString } from "class-validator";
import { PenAllocationService } from "./pen-allocation.service";

class FixPenAllocationDto {
  @IsOptional()
  @IsString()
  farmId?: string;
}

/**
 * Correction one-shot des loges mixtes (après déploiement du fix d'allocation).
 * Protégé par PEN_ALLOCATION_FIX_SECRET (en-tête x-pen-allocation-fix-secret).
 */
@Controller("admin")
export class AdminPenAllocationController {
  constructor(
    private readonly penAllocation: PenAllocationService,
    private readonly config: ConfigService
  ) {}

  @Post("fix-pen-allocation")
  async fixPenAllocation(
    @Headers("x-pen-allocation-fix-secret") secret: string | undefined,
    @Body() body: FixPenAllocationDto
  ) {
    const expected = this.config.get<string>("PEN_ALLOCATION_FIX_SECRET")?.trim();
    if (!expected || secret?.trim() !== expected) {
      throw new UnauthorizedException("Secret admin invalide");
    }

    const farmId = body.farmId?.trim();
    if (!farmId) {
      throw new BadRequestException("farmId requis dans le corps");
    }

    return this.penAllocation.fixFarmPenAllocation(farmId, "system-pen-fix");
  }
}
