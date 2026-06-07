import { Injectable } from "@nestjs/common";
import {
  Prisma,
  VetAppointmentConflictStatus,
  VetAppointmentStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { slotTimeFromDate } from "../vets/vet-visit-slots.constants";

const CONFLICT_WINDOW_MS = 2 * 60 * 60 * 1000;
const CALENDAR_BLOCK_STATUSES: VetAppointmentStatus[] = [
  VetAppointmentStatus.APPOINTMENT_CONFIRMED,
  VetAppointmentStatus.APPOINTMENT_IN_PROGRESS
];

export type ConflictDetectionResult = {
  status: VetAppointmentConflictStatus;
  conflictingAppointment?: {
    id: string;
    confirmedAt: string;
    producerName: string | null;
    farmName: string;
  };
};

@Injectable()
export class VetCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  /** Créneaux confirmés uniquement — pas les demandes en attente. */
  async getBlockedSlotsForDay(vetUserId: string, dateIso: string): Promise<Date[]> {
    const dayStart = new Date(`${dateIso}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const rows = await this.prisma.vetAppointment.findMany({
      where: {
        vetUserId,
        calendarBlocked: true,
        status: { in: CALENDAR_BLOCK_STATUSES },
        confirmedAt: { gte: dayStart, lt: dayEnd }
      },
      select: { confirmedAt: true }
    });
    return rows
      .map((r) => r.confirmedAt)
      .filter((d): d is Date => d != null);
  }

  async detectConflicts(
    vetUserId: string,
    requestedAt: Date,
    excludeAppointmentId?: string
  ): Promise<ConflictDetectionResult> {
    const windowStart = new Date(requestedAt.getTime() - CONFLICT_WINDOW_MS);
    const windowEnd = new Date(requestedAt.getTime() + CONFLICT_WINDOW_MS);
    const requestedSlot = slotTimeFromDate(requestedAt);

    const conflicts = await this.prisma.vetAppointment.findMany({
      where: {
        vetUserId,
        calendarBlocked: true,
        status: { in: CALENDAR_BLOCK_STATUSES },
        confirmedAt: { gte: windowStart, lte: windowEnd },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {})
      },
      include: {
        producer: { select: { fullName: true } },
        farm: { select: { name: true } }
      }
    });

    if (conflicts.length === 0) {
      return { status: VetAppointmentConflictStatus.AVAILABLE };
    }

    const exact = conflicts.find(
      (c) =>
        c.confirmedAt != null &&
        slotTimeFromDate(c.confirmedAt) === requestedSlot
    );
    const pick = exact ?? conflicts[0];
    const at = pick.confirmedAt!;

    return {
      status: exact
        ? VetAppointmentConflictStatus.CONFLICT_EXACT
        : VetAppointmentConflictStatus.CONFLICT_NEARBY,
      conflictingAppointment: {
        id: pick.id,
        confirmedAt: at.toISOString(),
        producerName: pick.producer.fullName,
        farmName: pick.farm.name
      }
    };
  }

  async blockSlot(
    tx: Prisma.TransactionClient,
    appointmentId: string,
    vetUserId: string,
    confirmedAt: Date,
    _durationHours: number
  ): Promise<void> {
    await tx.vetAppointment.update({
      where: { id: appointmentId },
      data: { calendarBlocked: true, confirmedAt, vetUserId }
    });
  }

  async unblockSlot(
    tx: Prisma.TransactionClient,
    appointmentId: string
  ): Promise<void> {
    await tx.vetAppointment.update({
      where: { id: appointmentId },
      data: { calendarBlocked: false }
    });
  }
}
