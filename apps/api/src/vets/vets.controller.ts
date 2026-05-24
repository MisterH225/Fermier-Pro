import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { CreateVetRatingDto } from "./dto/create-vet-rating.dto";
import { UpsertVetProfileDto } from "./dto/upsert-vet-profile.dto";
import { VetsService } from "./vets.service";

@Controller()
@UseGuards(SupabaseJwtGuard)
export class VetsController {
  constructor(private readonly vets: VetsService) {}

  @Get("vet-profiles/me")
  me(@CurrentUser() user: User) {
    return this.vets.getMyProfile(user);
  }

  @Post("vet-profiles")
  upsert(@CurrentUser() user: User, @Body() dto: UpsertVetProfileDto) {
    return this.vets.upsertProfile(user, dto);
  }

  @Get("vets/search")
  search(
    @CurrentUser() user: User,
    @Query("q") q?: string,
    @Query("specialty") specialty?: string,
    @Query("rating") rating?: string,
    @Query("available") available?: string,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string
  ) {
    const minRating =
      rating === "4" ? 4 : rating ? Number.parseFloat(rating) : 0;
    return this.vets.search(user, {
      q,
      specialty,
      minRating: Number.isFinite(minRating) ? minRating : 0,
      availableOnly: available === "1" || available === "true",
      nearLat: lat ? Number.parseFloat(lat) : undefined,
      nearLng: lng ? Number.parseFloat(lng) : undefined
    });
  }

  @Get("vets/:id/profile")
  publicProfile(@CurrentUser() user: User, @Param("id") id: string) {
    return this.vets.getPublicProfile(id, user);
  }

  @Post("vet-ratings/:vetId")
  rate(
    @CurrentUser() user: User,
    @Param("vetId") vetId: string,
    @Body() dto: CreateVetRatingDto
  ) {
    return this.vets.createRating(user, vetId, dto);
  }
}
