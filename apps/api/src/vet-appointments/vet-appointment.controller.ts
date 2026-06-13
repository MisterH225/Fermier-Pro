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
import { VetAcceptAppointmentDto } from "./dto/vet-accept-appointment.dto";
import { VetRefuseAppointmentDto } from "./dto/vet-refuse-appointment.dto";
import { RequestVetAppointmentDto } from "./dto/request-vet-appointment.dto";
import { ScheduleFromVetAppointmentDto } from "./dto/schedule-from-vet-appointment.dto";
import { SubmitAppointmentRatingDto } from "./dto/submit-appointment-rating.dto";
import { VetAppointmentService } from "./vet-appointment.service";

@Controller()
@UseGuards(SupabaseJwtGuard)
export class VetAppointmentController {
  constructor(private readonly appointments: VetAppointmentService) {}

  @Post("farms/:farmId/vet-appointments")
  request(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: RequestVetAppointmentDto
  ) {
    return this.appointments.requestAppointment(user, farmId, {
      vetProfileId: dto.vetProfileId,
      requestedAt: dto.scheduledAt,
      reason: dto.reason,
      notes: dto.notes,
      estimatedDurationHours: dto.estimatedDurationHours
    });
  }

  @Post("farms/:farmId/vet-appointments/schedule-from-vet")
  scheduleFromVet(
    @CurrentUser() user: User,
    @Param("farmId") farmId: string,
    @Body() dto: ScheduleFromVetAppointmentDto
  ) {
    return this.appointments.scheduleFromVetForCurrentUser(user, farmId, {
      scheduledAt: dto.scheduledAt,
      reason: dto.reason,
      notes: dto.notes,
      servicePrice: dto.consultationPrice
    });
  }

  @Get("vet-appointments/summary")
  financeSummary(
    @CurrentUser() user: User,
    @Query("role") role?: "producer" | "vet"
  ) {
    return this.appointments.getFinanceSummary(
      user,
      role === "vet" ? "vet" : "producer"
    );
  }

  @Get("vet-appointments/me")
  listMine(
    @CurrentUser() user: User,
    @Query("role") role?: "producer" | "vet"
  ) {
    return this.appointments.listForUser(user, role === "vet" ? "vet" : "producer");
  }

  @Get("vet-appointments/:id")
  getOne(@CurrentUser() user: User, @Param("id") id: string) {
    return this.appointments.getById(user, id);
  }

  @Post("vet-appointments/:id/accept")
  vetAccept(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: VetAcceptAppointmentDto
  ) {
    return this.appointments.vetAccept(user, id, {
      servicePrice: dto.servicePrice,
      confirmedAt: dto.confirmedAt,
      notes: dto.notes
    });
  }

  @Post("vet-appointments/:id/refuse")
  vetRefuse(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: VetRefuseAppointmentDto
  ) {
    return this.appointments.vetRefuse(user, id, dto.refusalReason);
  }

  @Post("vet-appointments/:id/payment/initiate")
  initiatePayment(@CurrentUser() user: User, @Param("id") id: string) {
    return this.appointments.initiatePayment(user, id);
  }

  @Post("vet-appointments/:id/payment/confirm")
  confirmPayment(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() body: { providerRef?: string }
  ) {
    return this.appointments.confirmPayment(user, id, body.providerRef);
  }

  @Post("vet-appointments/:id/complete")
  completeService(@CurrentUser() user: User, @Param("id") id: string) {
    return this.appointments.confirmServiceCompletion(user, id);
  }

  @Post("vet-appointments/:id/rating")
  submitRating(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: SubmitAppointmentRatingDto
  ) {
    return this.appointments.submitRating(user, id, dto);
  }

  @Post("vet-appointments/:id/cancel")
  async cancel(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() body: { reason?: string }
  ) {
    const r = await this.appointments.getById(user, id);
    if (r.vetUserId === user.id) {
      return this.appointments.cancelByVet(user, id, body.reason);
    }
    return this.appointments.cancelByProducer(user, id, body.reason);
  }
}
