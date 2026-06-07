import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { setDeprecatedSuccessor } from "../common/http/deprecation.util";
import { CreateVetRatingDto } from "./dto/create-vet-rating.dto";
import { ScheduleVetVisitDto } from "./dto/schedule-vet-visit.dto";
import { ProducerScheduleVetVisitDto } from "./dto/producer-schedule-vet-visit.dto";
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

  @Get("vet-profiles/me/dashboard")
  dashboard(@CurrentUser() user: User) {
    return this.vets.getDashboard(user);
  }

  @Post("vet-profiles/me/schedule-visit")
  scheduleVisit(
    @CurrentUser() user: User,
    @Body() dto: ScheduleVetVisitDto,
    @Res({ passthrough: true }) res: Response
  ) {
    setDeprecatedSuccessor(
      res,
      "/api/v1/farms/:farmId/vet-appointments",
      "Sat, 01 Jul 2027 00:00:00 GMT"
    );
    return this.vets.scheduleVisit(user, dto);
  }

  @Get("vets/:vetId/availability")
  availability(
    @Param("vetId") vetId: string,
    @Query("date") date: string
  ) {
    const day =
      date?.trim() ||
      new Date().toISOString().slice(0, 10);
    return this.vets.getVetAvailability(vetId, day);
  }

  @Post("farms/:farmId/schedule-vet-visit")
  scheduleFromProducer(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: ProducerScheduleVetVisitDto,
    @Res({ passthrough: true }) res: Response
  ) {
    setDeprecatedSuccessor(
      res,
      `/api/v1/farms/${farmId}/vet-appointments`
    );
    return this.vets.scheduleVisitFromProducer(user, farmId, dto);
  }

  @Get("farms/:farmId/vet-visit-quotes")
  listVisitQuotes(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Res({ passthrough: true }) res: Response
  ) {
    setDeprecatedSuccessor(
      res,
      `/api/v1/farms/${farmId}/vet-appointments`,
      "Sat, 01 Jul 2027 00:00:00 GMT"
    );
    return this.vets.listPendingVisitQuotes(user, farmId);
  }

  @Post("farms/:farmId/vet-visit-quotes/:consultationId/respond")
  respondVisitQuote(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Param("consultationId") consultationId: string,
    @Body()
    body: { action: "accept" | "refuse" | "counter"; counterPrice?: number },
    @Res({ passthrough: true }) res: Response
  ) {
    setDeprecatedSuccessor(
      res,
      `/api/v1/farms/${farmId}/vet-appointments`,
      "Sat, 01 Jul 2027 00:00:00 GMT"
    );
    return this.vets.respondVisitQuote(
      user,
      farmId,
      consultationId,
      body.action,
      body.counterPrice
    );
  }

  @Post("vet-consultations/:consultationId/submit-quote")
  submitVisitQuote(
    @CurrentUser() user: User,
    @Param("consultationId") consultationId: string,
    @Body() body: { price: number; note?: string },
    @Res({ passthrough: true }) res: Response
  ) {
    setDeprecatedSuccessor(
      res,
      "/api/v1/farms/:farmId/vet-appointments",
      "Sat, 01 Jul 2027 00:00:00 GMT"
    );
    return this.vets.submitVisitQuote(
      user,
      consultationId,
      body.price,
      body.note
    );
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
