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
import { CreateAnimalDto } from "./dto/create-animal.dto";
import { CreateWeightDto } from "./dto/create-weight.dto";
import { PatchAnimalStatusDto } from "./dto/patch-animal-status.dto";
import { UpdateAnimalDto } from "./dto/update-animal.dto";
import { LivestockService } from "./livestock.service";

@Controller("farms/:farmId/animals")
@UseGuards(SupabaseJwtGuard, FarmScopesGuard)
export class LivestockController {
  constructor(private readonly livestock: LivestockService) {}

  @Get()
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  list(@CurrentUser() user: User, @Param("farmId") farmId: string) {
    return this.livestock.listAnimals(user, farmId);
  }

  @Post()
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  create(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: CreateAnimalDto
  ) {
    return this.livestock.createAnimal(user, farmId, dto);
  }

  @Patch(":animalId/status")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  patchStatus(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("animalId") animalId: string,
    @Body() dto: PatchAnimalStatusDto
  ) {
    return this.livestock.patchAnimalStatus(user, farmId, animalId, dto);
  }

  @Get(":animalId")
  @RequireFarmScopes(FARM_SCOPE.livestockRead)
  one(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("animalId") animalId: string
  ) {
    return this.livestock.getAnimal(user, farmId, animalId);
  }

  @Patch(":animalId")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  update(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("animalId") animalId: string,
    @Body() dto: UpdateAnimalDto
  ) {
    return this.livestock.updateAnimal(user, farmId, animalId, dto);
  }

  @Delete(":animalId")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  async remove(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("animalId") animalId: string
  ) {
    await this.livestock.deleteAnimal(user, farmId, animalId);
    return { ok: true };
  }

  @Post(":animalId/weights")
  @RequireFarmScopes(FARM_SCOPE.livestockWrite)
  addWeight(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("animalId") animalId: string,
    @Body() dto: CreateWeightDto
  ) {
    return this.livestock.addWeight(user, farmId, animalId, dto);
  }
}
