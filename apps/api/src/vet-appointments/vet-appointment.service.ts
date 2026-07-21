import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PlatformSettingsService } from "../platform-settings/platform-settings.service";
import type { User } from "@prisma/client";
import {
  MembershipRole,
  MarketplacePaymentMethod,
  Prisma,
  VetAppointmentFundMovementKind,
  VetAppointmentStatus,
  VetVerificationStatus
} from "@prisma/client";
import {
  APP_EVENT,
  isVetBookingSource,
  type VetBookingSource
} from "../app-events/app-events.constants";
import { AppEventsService } from "../app-events/app-events.service";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { PrismaService } from "../prisma/prisma.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { UserNotificationsService } from "../user-notifications/user-notifications.service";
import {
  MOBILE_MONEY_GATEWAY,
  type MobileMoneyGateway
} from "../marketplace/escrow/mobile-money.gateway";
import { UserWalletService } from "../wallet/user-wallet.service";
import { VetCalendarService } from "./vet-calendar.service";
import {
  assertTransition,
  CANCELLABLE_BEFORE_IN_PROGRESS
} from "./vet-appointment-state-machine";

/** Délai de paiement après acceptation producteur (ou acceptation véto sur demande). */
const PAYMENT_DEADLINE_HOURS = 48;
/** Délai sans réponse producteur sur une proposition vétérinaire. */
const PROPOSAL_EXPIRY_HOURS = 72;
const RATING_TAGS = [
  "Ponctuel",
  "Professionnel",
  "Bon diagnostic",
  "Prix raisonnable"
] as const;

const VET_APPOINTMENT_INCLUDE = {
  farm: { select: { id: true, name: true, address: true } },
  producer: { select: { id: true, fullName: true, phone: true } },
  vetProfile: {
    select: { id: true, fullName: true, professionalPhone: true }
  },
  vet: { select: { id: true, fullName: true } },
  rating: true
} as const;

type VetAppointmentRow = Prisma.VetAppointmentGetPayload<{
  include: typeof VET_APPOINTMENT_INCLUDE;
}>;

@Injectable()
export class VetAppointmentService {
  private readonly log = new Logger(VetAppointmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService,
    private readonly push: PushNotificationsService,
    private readonly userNotifications: UserNotificationsService,
    private readonly calendar: VetCalendarService,
    private readonly config: ConfigService,
    private readonly platformSettings: PlatformSettingsService,
    @Inject(MOBILE_MONEY_GATEWAY)
    private readonly gateway: MobileMoneyGateway,
    private readonly userWallet: UserWalletService,
    private readonly appEvents: AppEventsService
  ) {}

  /** Inbox cloche + push Expo (évite les push « fantômes » non persistés). */
  private async notifyUser(
    userId: string,
    title: string,
    body: string,
    data: Record<string, string>
  ): Promise<void> {
    await this.userNotifications.notify(userId, title, body, data);
  }

  private async commissionRate(): Promise<number> {
    return this.platformSettings.getVetCommissionRate();
  }

  private formatWhen(d: Date): string {
    return d.toLocaleString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  private conflictLabel(
    status: string | null | undefined,
    details: { confirmedAt?: string; producerName?: string | null } | null
  ): string {
    if (status === "CONFLICT_EXACT" && details?.confirmedAt) {
      const t = this.formatWhen(new Date(details.confirmedAt));
      const who = details.producerName?.trim() || "un producteur";
      return `Conflit à ${t} avec ${who}`;
    }
    if (status === "CONFLICT_NEARBY" && details?.confirmedAt) {
      return `RDV proche à ${this.formatWhen(new Date(details.confirmedAt))}`;
    }
    return "Créneau disponible";
  }

  private mapRow(row: VetAppointmentRow) {
    let conflictDetails: Record<string, unknown> | null = null;
    if (row.conflictDetails && typeof row.conflictDetails === "object") {
      conflictDetails = row.conflictDetails as Record<string, unknown>;
    }
    return {
      id: row.id,
      farmId: row.farmId,
      farmName: row.farm?.name,
      farmLocation: row.farmLocation,
      producerUserId: row.producerUserId,
      producerName: row.producer?.fullName,
      vetProfileId: row.vetProfileId,
      vetUserId: row.vetUserId,
      vetName: row.vetProfile?.fullName ?? row.vet?.fullName,
      status: row.status,
      requestedAt: row.requestedAt.toISOString(),
      scheduledAt: row.requestedAt.toISOString(),
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      estimatedDurationHours: Number(row.estimatedDurationHours),
      reason: row.reason,
      notes: row.notes,
      refusalReason: row.refusalReason,
      vetResponseNotes: row.vetResponseNotes,
      servicePrice:
        row.servicePrice != null ? Number(row.servicePrice) : null,
      isFree: row.isFree,
      blockedAmount:
        row.blockedAmount != null ? Number(row.blockedAmount) : null,
      paymentDeadline: row.paymentDeadline?.toISOString() ?? null,
      paymentConfirmedAt: row.paymentConfirmedAt?.toISOString() ?? null,
      proposedByVetAt: row.proposedByVetAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      cancellationReason: row.cancellationReason,
      conflictStatus: row.conflictStatus,
      conflictLabel: this.conflictLabel(row.conflictStatus, conflictDetails),
      conflictDetails,
      currency: row.currency,
      rating: row.rating
        ? {
            rating: row.rating.rating,
            comment: row.rating.comment,
            tags: row.rating.tags
          }
        : null
    };
  }

  async requestAppointment(
    producer: User,
    farmId: string,
    input: {
      vetProfileId: string;
      requestedAt: string;
      reason: string;
      notes?: string;
      estimatedDurationHours?: number;
      bookingSource?: VetBookingSource;
    }
  ) {
    await this.farmAccess.requireFarmAccess(producer.id, farmId);

    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { name: true, address: true, owner: { select: { fullName: true } } }
    });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }

    const vetProfile = await this.prisma.vetProfile.findUnique({
      where: { id: input.vetProfileId }
    });
    if (!vetProfile || vetProfile.verificationStatus !== VetVerificationStatus.verified) {
      throw new NotFoundException("Vétérinaire introuvable ou non vérifié");
    }
    if (!vetProfile.availability) {
      throw new BadRequestException(
        "Ce vétérinaire n'accepte pas de nouveaux rendez-vous pour le moment"
      );
    }
    if (vetProfile.userId === producer.id) {
      throw new BadRequestException(
        "Vous ne pouvez pas demander un rendez-vous avec vous-même"
      );
    }

    const requestedAt = new Date(input.requestedAt);
    if (Number.isNaN(requestedAt.getTime())) {
      throw new BadRequestException("Date de rendez-vous invalide");
    }
    if (requestedAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException(
        "Le rendez-vous doit être planifié dans le futur"
      );
    }

    const conflict = await this.calendar.detectConflicts(
      vetProfile.userId,
      requestedAt
    );

    const farmLocation =
      farm.address?.trim() ||
      [farm.name].filter(Boolean).join(" · ") ||
      "—";

    const row = await this.prisma.vetAppointment.create({
      data: {
        farmId,
        producerUserId: producer.id,
        vetProfileId: vetProfile.id,
        vetUserId: vetProfile.userId,
        status: VetAppointmentStatus.APPOINTMENT_REQUESTED,
        requestedAt,
        estimatedDurationHours: input.estimatedDurationHours ?? 1,
        reason: input.reason,
        notes: input.notes?.trim() || null,
        farmLocation,
        commissionRate: new Prisma.Decimal(await this.commissionRate()),
        conflictStatus: conflict.status,
        conflictDetails: conflict.conflictingAppointment
          ? (conflict.conflictingAppointment as Prisma.InputJsonValue)
          : undefined
      },
      include: VET_APPOINTMENT_INCLUDE
    });

    const producerLabel =
      producer.fullName?.trim() || farm.owner.fullName?.trim() || "Un producteur";
    const when = this.formatWhen(requestedAt);
    const conflictHint = this.conflictLabel(conflict.status, conflict.conflictingAppointment ?? null);

    await this.push.sendToUser(
      vetProfile.userId,
      "Nouvelle demande de RDV",
      `${producerLabel} — ${farm.name} le ${when}. Motif: ${input.reason}. ${conflictHint}`,
      {
        type: "vet_appointment_requested",
        appointmentId: row.id,
        farmId,
        conflictStatus: conflict.status
      }
    );

    await this.audit.record({
      actorUserId: producer.id,
      farmId,
      action: AUDIT_ACTION.vetConsultationCreated,
      resourceType: "VetAppointment",
      resourceId: row.id,
      metadata: { requestedAt: requestedAt.toISOString(), reason: input.reason }
    });

    const source: VetBookingSource = isVetBookingSource(input.bookingSource)
      ? input.bookingSource
      : "vet_search";
    this.appEvents.trackFireAndForget(
      APP_EVENT.vetBookingSource,
      { source },
      { userId: producer.id }
    );

    return this.mapRow(row);
  }

  /** Planification initiée par le vétérinaire connecté (successeur de vet-profiles/me/schedule-visit). */
  async scheduleFromVetForCurrentUser(
    user: User,
    farmId: string,
    input: {
      scheduledAt: string;
      reason: string;
      notes?: string;
      servicePrice?: number;
      isFree?: boolean;
    }
  ) {
    const vetProfile = await this.prisma.vetProfile.findUnique({
      where: { userId: user.id }
    });
    if (!vetProfile) {
      throw new NotFoundException("Profil vétérinaire non créé");
    }
    if (vetProfile.verificationStatus !== VetVerificationStatus.verified) {
      throw new ForbiddenException(
        "Profil vétérinaire non vérifié — planification impossible"
      );
    }

    const membership = await this.prisma.farmMembership.findFirst({
      where: {
        farmId,
        userId: user.id,
        role: MembershipRole.veterinarian
      }
    });
    if (!membership) {
      throw new ForbiddenException("Ferme non assignée à ce vétérinaire");
    }
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.vetWrite
    ]);

    const appt = await this.scheduleFromVet(
      user.id,
      vetProfile.id,
      farmId,
      input
    );

    return {
      id: appt.id,
      farmId: appt.farmId,
      farmName: appt.farmName,
      scheduledAt: appt.scheduledAt,
      subject: appt.reason,
      status: appt.status
    };
  }

  /**
   * Proposition initiée par le vétérinaire.
   * Crée toujours en VISIT_PROPOSED — le producteur doit accepter/refuser.
   * Exige SOIT servicePrice > 0 SOIT isFree === true (pas d'ambiguïté).
   */
  async scheduleFromVet(
    vetUserId: string,
    vetProfileId: string,
    farmId: string,
    input: {
      scheduledAt: string;
      reason: string;
      notes?: string;
      servicePrice?: number;
      isFree?: boolean;
    }
  ) {
    const vetProfile = await this.prisma.vetProfile.findUnique({
      where: { id: vetProfileId }
    });
    if (!vetProfile || vetProfile.userId !== vetUserId) {
      throw new NotFoundException("Profil vétérinaire introuvable");
    }
    if (vetProfile.verificationStatus !== VetVerificationStatus.verified) {
      throw new ForbiddenException("Profil vétérinaire non vérifié");
    }

    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        name: true,
        address: true,
        ownerId: true,
        owner: { select: { fullName: true } }
      }
    });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }

    const requestedAt = new Date(input.scheduledAt);
    if (Number.isNaN(requestedAt.getTime())) {
      throw new BadRequestException("Date de visite invalide");
    }
    if (requestedAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException("La visite doit être planifiée dans le futur");
    }

    const isFree = input.isFree === true;
    const hasPrice =
      input.servicePrice != null &&
      Number.isFinite(input.servicePrice) &&
      input.servicePrice > 0;

    if (isFree && hasPrice) {
      throw new BadRequestException(
        "Une visite ne peut pas être à la fois gratuite et payante"
      );
    }
    if (!isFree && !hasPrice) {
      throw new BadRequestException(
        "Déclarez un montant (servicePrice > 0) ou isFree=true avant de proposer la visite"
      );
    }

    const conflict = await this.calendar.detectConflicts(vetUserId, requestedAt);
    const farmLocation =
      farm.address?.trim() || farm.name?.trim() || "—";
    const duration = 1;
    const proposedByVetAt = new Date();
    const price = hasPrice ? input.servicePrice! : null;

    const row = await this.prisma.vetAppointment.create({
      data: {
        farmId,
        producerUserId: farm.ownerId,
        vetProfileId: vetProfile.id,
        vetUserId,
        status: VetAppointmentStatus.VISIT_PROPOSED,
        requestedAt,
        confirmedAt: requestedAt,
        estimatedDurationHours: duration,
        reason: input.reason,
        notes: input.notes?.trim() || null,
        farmLocation,
        isFree,
        servicePrice: price != null ? new Prisma.Decimal(price) : null,
        blockedAmount: price != null ? new Prisma.Decimal(price) : null,
        proposedByVetAt,
        commissionRate: new Prisma.Decimal(await this.commissionRate()),
        conflictStatus: conflict.status,
        conflictDetails: conflict.conflictingAppointment
          ? (conflict.conflictingAppointment as Prisma.InputJsonValue)
          : undefined
      },
      include: VET_APPOINTMENT_INCLUDE
    });

    const vetName = row.vetProfile?.fullName ?? "Vétérinaire";
    const when = this.formatWhen(requestedAt);
    const priceLabel = isFree
      ? "Gratuite"
      : `Montant ${Math.round(price!).toLocaleString("fr-FR")} FCFA`;

    await this.notifyUser(
      farm.ownerId,
      "Proposition de visite",
      `Dr ${vetName} propose une visite le ${when} — ${priceLabel}. Acceptez ou refusez.`,
      {
        type: "vet_appointment_proposed",
        appointmentId: row.id,
        farmId
      }
    );

    await this.audit.record({
      actorUserId: vetUserId,
      farmId,
      action: AUDIT_ACTION.vetConsultationCreated,
      resourceType: "VetAppointment",
      resourceId: row.id,
      metadata: {
        initiatedBy: "vet",
        requestedAt: requestedAt.toISOString(),
        isFree,
        servicePrice: price
      }
    });

    return this.mapRow(row);
  }

  /**
   * Producteur accepte une proposition vétérinaire (VISIT_PROPOSED).
   * Gratuite → APPOINTMENT_CONFIRMED ; payante → AWAITING_PAYMENT (deadline 48h démarre ici).
   */
  async producerAccept(producer: User, appointmentId: string) {
    const row = await this.requireProducerAppointment(producer.id, appointmentId, [
      VetAppointmentStatus.VISIT_PROPOSED
    ]);

    if (row.isFree) {
      assertTransition(row.status, "PRODUCER_ACCEPT_FREE");
      const confirmedAt = row.confirmedAt ?? row.requestedAt;
      const duration = Number(row.estimatedDurationHours);

      const updated = await this.prisma.$transaction(async (tx) => {
        const appt = await tx.vetAppointment.update({
          where: { id: appointmentId },
          data: {
            status: VetAppointmentStatus.APPOINTMENT_CONFIRMED,
            confirmedAt
          },
          include: VET_APPOINTMENT_INCLUDE
        });
        await this.calendar.blockSlot(
          tx,
          appointmentId,
          row.vetUserId,
          confirmedAt,
          duration
        );
        return tx.vetAppointment.findUniqueOrThrow({
          where: { id: appt.id },
          include: VET_APPOINTMENT_INCLUDE
        });
      });

      const when = this.formatWhen(confirmedAt);
      const producerName = updated.producer?.fullName?.trim() || "Producteur";
      await this.push.sendToUser(
        updated.vetUserId,
        "Visite acceptée",
        `${producerName} a accepté votre visite gratuite du ${when}.`,
        {
          type: "vet_appointment_confirmed",
          appointmentId,
          farmId: updated.farmId
        }
      );
      await this.push.sendToUser(
        updated.producerUserId,
        "Visite confirmée",
        `Visite gratuite confirmée avec Dr ${updated.vetProfile?.fullName ?? "le vétérinaire"} le ${when}.`,
        {
          type: "vet_appointment_confirmed",
          appointmentId,
          farmId: updated.farmId
        }
      );

      return this.mapRow(updated);
    }

    const price = Number(row.servicePrice ?? row.blockedAmount ?? 0);
    if (!Number.isFinite(price) || price <= 0) {
      throw new BadRequestException(
        "Montant de la proposition invalide — contactez le vétérinaire"
      );
    }

    assertTransition(row.status, "PRODUCER_ACCEPT_PAID");
    const paymentDeadline = new Date();
    paymentDeadline.setHours(
      paymentDeadline.getHours() + PAYMENT_DEADLINE_HOURS
    );

    const updated = await this.prisma.vetAppointment.update({
      where: { id: appointmentId },
      data: {
        status: VetAppointmentStatus.AWAITING_PAYMENT,
        servicePrice: new Prisma.Decimal(price),
        blockedAmount: new Prisma.Decimal(price),
        paymentDeadline
      },
      include: VET_APPOINTMENT_INCLUDE
    });

    const when = this.formatWhen(updated.confirmedAt ?? updated.requestedAt);
    const priceFmt = `${Math.round(price).toLocaleString("fr-FR")} FCFA`;
    const producerName = updated.producer?.fullName?.trim() || "Producteur";

    await this.push.sendToUser(
      updated.vetUserId,
      "Proposition acceptée",
      `${producerName} a accepté la visite du ${when}. En attente de paiement (${priceFmt}).`,
      {
        type: "vet_appointment_accepted",
        appointmentId,
        farmId: updated.farmId
      }
    );
    await this.push.sendToUser(
      updated.producerUserId,
      "Paiement requis",
      `Payez ${priceFmt} avant ${this.formatWhen(paymentDeadline)} pour confirmer la visite du ${when}.`,
      {
        type: "vet_appointment_accepted",
        appointmentId,
        farmId: updated.farmId
      }
    );

    return this.mapRow(updated);
  }

  /**
   * Producteur refuse une proposition (VISIT_PROPOSED) ou un montant (AWAITING_PAYMENT).
   */
  async producerRefuse(
    producer: User,
    appointmentId: string,
    refusalReason: string
  ) {
    const note = refusalReason.trim();
    if (!note) {
      throw new BadRequestException(
        "Un motif de refus est obligatoire pour informer le vétérinaire"
      );
    }

    const row = await this.requireProducerAppointment(producer.id, appointmentId, [
      VetAppointmentStatus.VISIT_PROPOSED,
      VetAppointmentStatus.AWAITING_PAYMENT
    ]);

    assertTransition(row.status, "PRODUCER_REFUSE");

    const updated = await this.prisma.$transaction(async (tx) => {
      if (row.calendarBlocked) {
        await this.calendar.unblockSlot(tx, appointmentId);
      }
      return tx.vetAppointment.update({
        where: { id: appointmentId },
        data: {
          status: VetAppointmentStatus.REFUSED_BY_PRODUCER,
          refusalReason: note,
          cancelledAt: new Date(),
          paymentDeadline: null
        },
        include: VET_APPOINTMENT_INCLUDE
      });
    });

    const producerName = updated.producer?.fullName?.trim() || "Le producteur";
    const when = this.formatWhen(updated.confirmedAt ?? updated.requestedAt);

    await this.notifyUser(
      updated.vetUserId,
      "Proposition refusée",
      `${producerName} a refusé la visite du ${when}. Motif : ${note.slice(0, 160)}`,
      {
        type: "vet_appointment_refused_by_producer",
        appointmentId,
        farmId: updated.farmId
      }
    );

    return this.mapRow(updated);
  }

  async listForUser(
    user: User,
    role: "producer" | "vet",
    farmId?: string
  ) {
    const where =
      role === "vet"
        ? { vetUserId: user.id, ...(farmId ? { farmId } : {}) }
        : { producerUserId: user.id, ...(farmId ? { farmId } : {}) };

    const rows = await this.prisma.vetAppointment.findMany({
      where,
      orderBy: { requestedAt: "desc" },
      take: 50,
      include: VET_APPOINTMENT_INCLUDE
    });
    return rows.map((r) => this.mapRow(r));
  }

  async getFinanceSummary(user: User, role: "producer" | "vet") {
    const currency = "XOF";
    const pendingStatuses: VetAppointmentStatus[] = [
      VetAppointmentStatus.APPOINTMENT_CONFIRMED,
      VetAppointmentStatus.APPOINTMENT_IN_PROGRESS
    ];
    const completedStatuses: VetAppointmentStatus[] = [
      VetAppointmentStatus.APPOINTMENT_COMPLETED,
      VetAppointmentStatus.APPOINTMENT_RATED
    ];

    if (role === "vet") {
      const [pendingAgg, confirmedAgg, pendingRows] = await Promise.all([
        this.prisma.vetAppointment.aggregate({
          where: { vetUserId: user.id, status: { in: pendingStatuses } },
          _sum: { servicePrice: true }
        }),
        this.prisma.vetAppointment.aggregate({
          where: { vetUserId: user.id, status: { in: completedStatuses } },
          _sum: { vetReceivedAmount: true }
        }),
        this.prisma.vetAppointment.findMany({
          where: { vetUserId: user.id, status: { in: pendingStatuses } },
          orderBy: { confirmedAt: "asc" },
          take: 10,
          include: VET_APPOINTMENT_INCLUDE
        })
      ]);

      return {
        role: "vet" as const,
        pendingEarnings: Number(pendingAgg._sum.servicePrice ?? 0),
        confirmedEarnings: Number(confirmedAgg._sum.vetReceivedAmount ?? 0),
        blockedForAppointments: 0,
        currency,
        pendingAppointments: pendingRows.map((r) => ({
          id: r.id,
          farmName: r.farm.name,
          producerName: r.producer.fullName,
          amount: Number(r.servicePrice ?? r.blockedAmount ?? 0),
          status: r.status,
          confirmedAt: r.confirmedAt?.toISOString() ?? null
        }))
      };
    }

    const [blockedAgg, blockedRows] = await Promise.all([
      this.prisma.vetAppointment.aggregate({
        where: {
          producerUserId: user.id,
          status: { in: pendingStatuses }
        },
        _sum: { blockedAmount: true }
      }),
      this.prisma.vetAppointment.findMany({
        where: {
          producerUserId: user.id,
          status: { in: pendingStatuses }
        },
        orderBy: { confirmedAt: "asc" },
        take: 10,
        include: VET_APPOINTMENT_INCLUDE
      })
    ]);

    return {
      role: "producer" as const,
      pendingEarnings: 0,
      confirmedEarnings: 0,
      blockedForAppointments: Number(blockedAgg._sum.blockedAmount ?? 0),
      currency,
      blockedAppointments: blockedRows.map((r) => ({
        id: r.id,
        farmName: r.farm.name,
        vetName: r.vetProfile.fullName,
        amount: Number(r.blockedAmount ?? r.servicePrice ?? 0),
        status: r.status,
        confirmedAt: r.confirmedAt?.toISOString() ?? null
      }))
    };
  }

  async getById(user: User, appointmentId: string) {
    const row = await this.prisma.vetAppointment.findUnique({
      where: { id: appointmentId },
      include: VET_APPOINTMENT_INCLUDE
    });
    if (!row) {
      throw new NotFoundException("Rendez-vous introuvable");
    }
    // Seuls le producteur et le vétérinaire du rendez-vous peuvent y accéder.
    // Les membres de la ferme (viewer, worker…) n'ont pas accès aux informations
    // médicales et financières des consultations vétérinaires.
    if (row.producerUserId !== user.id && row.vetUserId !== user.id) {
      throw new ForbiddenException("Accès refusé");
    }
    return this.mapRow(row);
  }

  async vetAccept(
    vet: User,
    appointmentId: string,
    input: {
      servicePrice: number;
      confirmedAt?: string;
      notes?: string;
    }
  ) {
    const row = await this.requireVetAppointment(vet.id, appointmentId, [
      VetAppointmentStatus.APPOINTMENT_REQUESTED
    ]);

    if (input.servicePrice <= 0 || !Number.isFinite(input.servicePrice)) {
      throw new BadRequestException("Tarif de prestation invalide");
    }

    const confirmedAt = input.confirmedAt
      ? new Date(input.confirmedAt)
      : row.requestedAt;
    if (Number.isNaN(confirmedAt.getTime())) {
      throw new BadRequestException("Date confirmée invalide");
    }

    const paymentDeadline = new Date();
    paymentDeadline.setHours(paymentDeadline.getHours() + PAYMENT_DEADLINE_HOURS);

    const updated = await this.prisma.vetAppointment.update({
      where: { id: appointmentId },
      data: {
        status: VetAppointmentStatus.AWAITING_PAYMENT,
        servicePrice: new Prisma.Decimal(input.servicePrice),
        blockedAmount: new Prisma.Decimal(input.servicePrice),
        confirmedAt,
        vetResponseNotes: input.notes?.trim() || null,
        paymentDeadline
      },
      include: VET_APPOINTMENT_INCLUDE
    });

    const vetName = updated.vetProfile?.fullName ?? "Vétérinaire";
    const when = this.formatWhen(confirmedAt);
    const priceFmt = `${Math.round(input.servicePrice).toLocaleString("fr-FR")} FCFA`;

    await this.push.sendToUser(
      updated.producerUserId,
      "Demande acceptée",
      `Dr ${vetName} accepte votre demande. Prestation: ${priceFmt}. Payez avant ${this.formatWhen(paymentDeadline)} pour confirmer le RDV le ${when}.`,
      {
        type: "vet_appointment_accepted",
        appointmentId,
        farmId: updated.farmId
      }
    );

    return this.mapRow(updated);
  }

  async vetRefuse(
    vet: User,
    appointmentId: string,
    refusalReason?: string
  ) {
    await this.requireVetAppointment(vet.id, appointmentId, [
      VetAppointmentStatus.APPOINTMENT_REQUESTED
    ]);

    const updated = await this.prisma.vetAppointment.update({
      where: { id: appointmentId },
      data: {
        status: VetAppointmentStatus.APPOINTMENT_REFUSED,
        refusalReason: refusalReason?.trim() || null,
        cancelledAt: new Date()
      },
      include: VET_APPOINTMENT_INCLUDE
    });

    const vetName = updated.vetProfile?.fullName ?? "Le vétérinaire";
    const reasonSuffix = refusalReason?.trim()
      ? ` ${refusalReason.trim()}`
      : "";

    await this.push.sendToUser(
      updated.producerUserId,
      "Demande refusée",
      `Dr ${vetName} ne peut pas honorer votre demande.${reasonSuffix} Consultez d'autres vétérinaires.`,
      { type: "vet_appointment_refused", appointmentId }
    );

    return this.mapRow(updated);
  }

  async initiatePayment(
    producer: User,
    appointmentId: string,
    dto: { paymentMethod: "mobile_money" | "wallet" }
  ) {
    const row = await this.requireProducerAppointment(producer.id, appointmentId, [
      VetAppointmentStatus.AWAITING_PAYMENT
    ]);

    if (row.paymentDeadline && row.paymentDeadline.getTime() < Date.now()) {
      throw new BadRequestException("Délai de paiement expiré");
    }

    const amount = Number(row.blockedAmount ?? row.servicePrice);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Montant invalide");
    }

    const paymentMethod =
      dto.paymentMethod === "wallet"
        ? MarketplacePaymentMethod.wallet
        : MarketplacePaymentMethod.mobile_money;

    if (paymentMethod === MarketplacePaymentMethod.wallet) {
      await this.userWallet.assertSufficientBalance(producer.id, amount);
      const providerRef = this.userWallet.vetWalletPendingRef(appointmentId);
      await this.prisma.vetAppointment.update({
        where: { id: appointmentId },
        data: {
          paymentProviderRef: providerRef,
          paymentMethod
        }
      });
      return {
        providerRef,
        amount,
        currency: row.currency,
        paymentUrl: null,
        paymentMethod: "wallet"
      };
    }

    const init = await this.gateway.initiatePayment({
      amount,
      currency: row.currency,
      buyerUserId: producer.id,
      transactionId: appointmentId,
      label: `RDV vétérinaire — ${row.farm.name}`
    });

    await this.prisma.vetAppointmentFundMovement.create({
      data: {
        appointmentId,
        kind: VetAppointmentFundMovementKind.HOLD,
        amount: new Prisma.Decimal(amount),
        currency: row.currency,
        providerRef: init.providerRef,
        note: "Initiation paiement RDV"
      }
    });

    await this.prisma.vetAppointment.update({
      where: { id: appointmentId },
      data: {
        paymentProviderRef: init.providerRef,
        paymentMethod
      }
    });

    return {
      providerRef: init.providerRef,
      amount,
      currency: row.currency,
      paymentUrl: init.paymentUrl ?? null,
      paymentMethod: "mobile_money"
    };
  }

  async confirmPayment(
    producer: User,
    appointmentId: string,
    providerRef?: string,
    _dto?: { paymentMethod?: "mobile_money" | "wallet" }
  ) {
    const row = await this.requireProducerAppointment(producer.id, appointmentId, [
      VetAppointmentStatus.AWAITING_PAYMENT
    ]);

    const ref = providerRef ?? row.paymentProviderRef;
    if (!ref) {
      throw new BadRequestException("Référence paiement manquante");
    }

    const amount = Number(row.blockedAmount ?? row.servicePrice ?? 0);
    let confirmedRef = ref;

    if (
      row.paymentMethod === MarketplacePaymentMethod.wallet ||
      this.userWallet.isVetWalletPendingRef(ref)
    ) {
      confirmedRef = await this.userWallet.confirmVetPendingHold(
        ref,
        producer.id,
        amount,
        row.currency,
        appointmentId,
        "Paiement RDV via portefeuille"
      );
      await this.prisma.vetAppointmentFundMovement.create({
        data: {
          appointmentId,
          kind: VetAppointmentFundMovementKind.HOLD,
          amount: new Prisma.Decimal(amount),
          currency: row.currency,
          providerRef: confirmedRef,
          note: "Blocage fonds RDV (portefeuille)"
        }
      });
    } else {
      const confirmed = await this.gateway.confirmPayment(ref, appointmentId);
      if (!confirmed.success) {
        throw new BadRequestException(
          confirmed.failureReason ?? "Paiement non confirmé"
        );
      }
    }

    const confirmedAt = row.confirmedAt ?? row.requestedAt;
    const duration = Number(row.estimatedDurationHours);

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.calendar.blockSlot(
        tx,
        appointmentId,
        row.vetUserId,
        confirmedAt,
        duration
      );
      return tx.vetAppointment.update({
        where: { id: appointmentId },
        data: {
          status: VetAppointmentStatus.APPOINTMENT_CONFIRMED,
          paymentConfirmedAt: new Date(),
          paymentProviderRef: confirmedRef,
          confirmedAt
        },
        include: VET_APPOINTMENT_INCLUDE
      });
    });

    const when = this.formatWhen(confirmedAt);
    const amountFmt = `${Math.round(Number(row.blockedAmount)).toLocaleString("fr-FR")} FCFA`;
    const producerName = updated.producer?.fullName?.trim() || "Producteur";
    const vetName = updated.vetProfile?.fullName ?? "Vétérinaire";

    await this.push.sendToUser(
      updated.vetUserId,
      "Paiement reçu",
      `RDV confirmé le ${when} avec ${producerName}. Montant sécurisé: ${amountFmt}.`,
      { type: "vet_appointment_payment_confirmed", appointmentId }
    );
    await this.push.sendToUser(
      updated.producerUserId,
      "RDV confirmé",
      `RDV confirmé avec Dr ${vetName} le ${when}.`,
      { type: "vet_appointment_confirmed", appointmentId }
    );

    return this.mapRow(updated);
  }

  /**
   * Clôture de prestation.
   * - Visite gratuite (isFree) : producteur OU vétérinaire → COMPLETED, zéro fonds.
   * - Visite payante : producteur uniquement → libération fonds + commission (inchangé).
   */
  async confirmServiceCompletion(user: User, appointmentId: string) {
    const row = await this.prisma.vetAppointment.findUnique({
      where: { id: appointmentId },
      include: VET_APPOINTMENT_INCLUDE
    });
    if (!row) {
      throw new NotFoundException("Rendez-vous introuvable");
    }

    const isProducer = row.producerUserId === user.id;
    const isVet = row.vetUserId === user.id;
    if (!isProducer && !isVet) {
      throw new ForbiddenException("Accès refusé");
    }

    const allowedStatuses: VetAppointmentStatus[] = [
      VetAppointmentStatus.APPOINTMENT_CONFIRMED,
      VetAppointmentStatus.APPOINTMENT_IN_PROGRESS
    ];
    if (!allowedStatuses.includes(row.status)) {
      throw new BadRequestException(
        `Action impossible pour le statut ${row.status}`
      );
    }

    const treatAsFree =
      row.isFree || this.isOrphanConfirmedWithoutPrice(row);

    if (treatAsFree) {
      if (!isProducer && !isVet) {
        throw new ForbiddenException("Accès refusé");
      }
      assertTransition(row.status, "SERVICE_COMPLETED_FREE");

      const updated = await this.prisma.$transaction(async (tx) => {
        const appt = await tx.vetAppointment.update({
          where: { id: appointmentId },
          data: {
            status: VetAppointmentStatus.APPOINTMENT_COMPLETED,
            completedAt: new Date(),
            isFree: true,
            commissionAmount: new Prisma.Decimal(0),
            vetReceivedAmount: new Prisma.Decimal(0)
          },
          include: VET_APPOINTMENT_INCLUDE
        });
        await tx.vetProfile.update({
          where: { id: row.vetProfileId },
          data: { completedAppointments: { increment: 1 } }
        });
        return appt;
      });

      const notifyUserId = isProducer ? updated.vetUserId : updated.producerUserId;
      const actorLabel = isProducer
        ? updated.producer?.fullName?.trim() || "le producteur"
        : `Dr ${updated.vetProfile?.fullName ?? "le vétérinaire"}`;
      await this.notifyUser(
        notifyUserId,
        "Visite terminée",
        `Visite clôturée par ${actorLabel}. Aucun règlement.`,
        { type: "vet_appointment_completed", appointmentId }
      );

      return {
        ...this.mapRow(updated),
        requiresRating: isProducer
      };
    }

    if (!isProducer) {
      throw new ForbiddenException(
        "Seul le producteur peut confirmer la fin d'une visite payante"
      );
    }

    assertTransition(row.status, "SERVICE_COMPLETED");

    const servicePrice = Number(row.servicePrice);
    if (!Number.isFinite(servicePrice) || servicePrice <= 0) {
      throw new BadRequestException("Montant prestation invalide");
    }

    const rate = Number(row.commissionRate);
    const commissionAmount = Math.round(servicePrice * rate * 100) / 100;
    const vetReceives = Math.round((servicePrice - commissionAmount) * 100) / 100;

    const updated = await this.prisma.$transaction(async (tx) => {
      const appt = await tx.vetAppointment.update({
        where: { id: appointmentId },
        data: {
          status: VetAppointmentStatus.APPOINTMENT_COMPLETED,
          completedAt: new Date(),
          commissionAmount: new Prisma.Decimal(commissionAmount),
          vetReceivedAmount: new Prisma.Decimal(vetReceives)
        },
        include: VET_APPOINTMENT_INCLUDE
      });

      await tx.vetAppointmentFundMovement.create({
        data: {
          appointmentId,
          kind: VetAppointmentFundMovementKind.COMMISSION,
          amount: new Prisma.Decimal(commissionAmount),
          currency: row.currency,
          note: "Commission plateforme RDV"
        }
      });
      await tx.vetAppointmentFundMovement.create({
        data: {
          appointmentId,
          kind: VetAppointmentFundMovementKind.RELEASE_TO_VET,
          amount: new Prisma.Decimal(vetReceives),
          currency: row.currency,
          note: "Versement vétérinaire"
        }
      });

      await tx.platformRevenue.create({
        data: {
          vetAppointmentId: appointmentId,
          sellerId: row.vetUserId,
          buyerId: row.producerUserId,
          grossAmount: new Prisma.Decimal(servicePrice),
          commissionRate: new Prisma.Decimal(rate),
          commissionAmount: new Prisma.Decimal(commissionAmount),
          type: "APPOINTMENT_COMMISSION"
        }
      });

      await tx.vetProfile.update({
        where: { id: row.vetProfileId },
        data: { completedAppointments: { increment: 1 } }
      });

      // Dépense ferme automatique au règlement (montant verrouillé, non éditable).
      await this.ensureAutoVetAppointmentExpense(tx, {
        appointmentId,
        farmId: row.farmId,
        producerUserId: row.producerUserId,
        amount: servicePrice,
        currency: row.currency,
        vetName: appt.vetProfile?.fullName?.trim() || "Vétérinaire"
      });

      return appt;
    });

    void this.userWallet
      .creditVetPayout(
        row.vetUserId,
        vetReceives,
        row.currency,
        appointmentId,
        "Versement prestation vétérinaire (portefeuille)",
        `vet-release:${appointmentId}:${vetReceives}`
      )
      .catch((err) => this.log.warn(`credit vet wallet failed: ${err}`));

    const vetReceivesFmt = `${Math.round(vetReceives).toLocaleString("fr-FR")} FCFA`;
    await this.push.sendToUser(
      updated.vetUserId,
      "Prestation confirmée",
      `Prestation confirmée par ${updated.producer?.fullName ?? "le producteur"}. Virement de ${vetReceivesFmt} en cours.`,
      { type: "vet_appointment_completed", appointmentId }
    );

    return { ...this.mapRow(updated), requiresRating: true };
  }

  /**
   * Crée la dépense ferme liée au RDV si absente (idempotent via linkedEntity).
   * Fusionne l'ancien concept d'écriture à confirmPayment.
   */
  private async ensureAutoVetAppointmentExpense(
    tx: Prisma.TransactionClient,
    input: {
      appointmentId: string;
      farmId: string;
      producerUserId: string;
      amount: number;
      currency: string;
      vetName: string;
    }
  ): Promise<void> {
    if (!(input.amount > 0)) {
      return;
    }
    const existing = await tx.farmExpense.findFirst({
      where: {
        linkedEntityType: "vet_appointment",
        linkedEntityId: input.appointmentId
      },
      select: { id: true }
    });
    if (existing) {
      return;
    }
    await tx.farmExpense.create({
      data: {
        farmId: input.farmId,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency,
        label: `Consultation vétérinaire — ${input.vetName}`,
        category: "veterinaire",
        linkedEntityType: "vet_appointment",
        linkedEntityId: input.appointmentId,
        createdByUserId: input.producerUserId,
        source: "auto",
        occurredAt: new Date()
      }
    });
  }

  async submitRating(
    producer: User,
    appointmentId: string,
    input: { rating: number; comment?: string; tags?: string[] }
  ) {
    if (input.rating < 1 || input.rating > 5) {
      throw new BadRequestException("Note entre 1 et 5");
    }

    const row = await this.requireProducerAppointment(producer.id, appointmentId, [
      VetAppointmentStatus.APPOINTMENT_COMPLETED,
      VetAppointmentStatus.APPOINTMENT_RATED
    ]);

    if (row.rating) {
      throw new BadRequestException("Avis déjà enregistré");
    }

    const tags = (input.tags ?? []).filter((t) =>
      (RATING_TAGS as readonly string[]).includes(t)
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.vetAppointmentRating.create({
        data: {
          appointmentId,
          vetProfileId: row.vetProfileId,
          producerUserId: producer.id,
          rating: input.rating,
          comment: input.comment?.trim() || null,
          tags
        }
      });

      const agg = await tx.vetAppointmentRating.aggregate({
        where: { vetProfileId: row.vetProfileId },
        _avg: { rating: true },
        _count: { rating: true }
      });

      await tx.vetProfile.update({
        where: { id: row.vetProfileId },
        data: {
          ratingAvg:
            agg._avg.rating != null
              ? new Prisma.Decimal(
                  Math.round(agg._avg.rating * 100) / 100
                )
              : null,
          ratingCount: agg._count.rating
        }
      });

      await tx.vetAppointment.update({
        where: { id: appointmentId },
        data: { status: VetAppointmentStatus.APPOINTMENT_RATED }
      });
    });

    const vetProfile = await this.prisma.vetProfile.findUnique({
      where: { id: row.vetProfileId },
      select: { userId: true, fullName: true }
    });
    if (vetProfile) {
      await this.push.sendToUser(
        vetProfile.userId,
        "Nouvel avis",
        `${producer.fullName?.trim() || "Un producteur"} vous a attribué ${input.rating}/5 étoiles.`,
        { type: "vet_appointment_rated", appointmentId }
      );
    }

    return this.getById(producer, appointmentId);
  }

  /** Fonds réellement bloqués après paiement confirmé (pas une simple proposition tarifée). */
  private hasConfirmedPayment(row: {
    paymentConfirmedAt: Date | null;
    blockedAmount: Prisma.Decimal | null;
  }): boolean {
    return (
      row.paymentConfirmedAt != null &&
      Number(row.blockedAmount ?? 0) > 0
    );
  }

  /**
   * Ancien flux : RDV confirmé sans tarif ni paiement — impossible à clôturer
   * via le chemin payant. Traité comme une visite gratuite pour la clôture.
   */
  private isOrphanConfirmedWithoutPrice(row: {
    status: VetAppointmentStatus;
    isFree: boolean;
    servicePrice: Prisma.Decimal | null;
    paymentConfirmedAt: Date | null;
    blockedAmount: Prisma.Decimal | null;
  }): boolean {
    if (row.status !== VetAppointmentStatus.APPOINTMENT_CONFIRMED) {
      return false;
    }
    if (row.isFree) {
      return false;
    }
    if (this.hasConfirmedPayment(row)) {
      return false;
    }
    const price = Number(row.servicePrice ?? 0);
    return !Number.isFinite(price) || price <= 0;
  }

  async cancelByProducer(producer: User, appointmentId: string, reason: string) {
    const note = reason.trim();
    if (!note) {
      throw new BadRequestException(
        "Un motif d'annulation est obligatoire pour informer l'autre partie"
      );
    }

    const row = await this.requireProducerAppointment(
      producer.id,
      appointmentId,
      [...CANCELLABLE_BEFORE_IN_PROGRESS]
    );

    assertTransition(row.status, "CANCEL_BY_PRODUCER");

    const wasPaid = this.hasConfirmedPayment(row);

    let refundAmount = 0;
    if (wasPaid) {
      refundAmount = Number(row.blockedAmount);
      if (refundAmount > 0) {
        await this.refundProducerToWallet(
          appointmentId,
          producer.id,
          refundAmount,
          row.currency,
          "Annulation producteur — remboursement intégral",
          "cancel-producer"
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (row.calendarBlocked) {
        await this.calendar.unblockSlot(tx, appointmentId);
      }
      await tx.vetAppointment.update({
        where: { id: appointmentId },
        data: {
          status: VetAppointmentStatus.CANCELLED_BY_PRODUCER,
          cancelledAt: new Date(),
          cancellationReason: note
        }
      });
    });

    const refundMsg =
      refundAmount > 0
        ? ` Remboursement intégral: ${Math.round(refundAmount).toLocaleString("fr-FR")} FCFA.`
        : "";
    const reasonMsg = ` Motif : ${note.slice(0, 160)}`;
    await this.notifyUser(
      row.vetUserId,
      "RDV annulé",
      `${producer.fullName?.trim() || "Le producteur"} a annulé.${refundMsg}${reasonMsg}`,
      { type: "vet_appointment_cancelled_producer", appointmentId }
    );

    await this.audit.record({
      actorUserId: producer.id,
      farmId: row.farmId,
      action: AUDIT_ACTION.vetAppointmentCancelled,
      resourceType: "VetAppointment",
      resourceId: appointmentId,
      metadata: {
        by: "producer",
        wasPaid,
        refundAmount,
        reason: note
      }
    });

    return this.getById(producer, appointmentId);
  }

  async cancelByVet(vet: User, appointmentId: string, reason: string) {
    const note = reason.trim();
    if (!note) {
      throw new BadRequestException(
        "Un motif d'annulation est obligatoire pour informer l'autre partie"
      );
    }

    const row = await this.requireVetAppointment(
      vet.id,
      appointmentId,
      [...CANCELLABLE_BEFORE_IN_PROGRESS]
    );

    assertTransition(row.status, "CANCEL_BY_VET");

    const wasPaid = this.hasConfirmedPayment(row);

    let refundAmount = 0;
    if (wasPaid) {
      refundAmount = Number(row.blockedAmount ?? row.servicePrice ?? 0);
      if (refundAmount > 0) {
        await this.refundProducerToWallet(
          appointmentId,
          row.producerUserId,
          refundAmount,
          row.currency,
          "Annulation vétérinaire — remboursement intégral",
          "cancel-vet"
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (row.calendarBlocked) {
        await this.calendar.unblockSlot(tx, appointmentId);
      }
      await tx.vetAppointment.update({
        where: { id: appointmentId },
        data: {
          status: VetAppointmentStatus.CANCELLED_BY_VET,
          cancelledAt: new Date(),
          cancellationReason: note
        }
      });
      await tx.vetProfile.update({
        where: { id: row.vetProfileId },
        data: {
          cancelledAppointmentsAsVet: { increment: 1 }
        }
      });
      if (wasPaid) {
        await tx.user.update({
          where: { id: vet.id },
          data: { reputationScore: { decrement: 2 } }
        });
      }
    });

    const vetName = row.vetProfile?.fullName ?? "Le vétérinaire";
    const refundMsg =
      refundAmount > 0
        ? ` Remboursement intégral de ${Math.round(refundAmount).toLocaleString("fr-FR")} FCFA.`
        : "";
    const reasonMsg = ` Motif : ${note.slice(0, 160)}`;
    await this.notifyUser(
      row.producerUserId,
      "RDV annulé",
      `Dr ${vetName} a annulé votre RDV.${refundMsg}${reasonMsg}`,
      { type: "vet_appointment_cancelled_vet", appointmentId }
    );

    await this.audit.record({
      actorUserId: vet.id,
      farmId: row.farmId,
      action: AUDIT_ACTION.vetAppointmentCancelled,
      resourceType: "VetAppointment",
      resourceId: appointmentId,
      metadata: {
        by: "vet",
        wasPaid,
        refundAmount,
        reason: note
      }
    });

    return this.getById(vet, appointmentId);
  }

  async handleExpiredPayments(): Promise<number> {
    const now = new Date();
    const expired = await this.prisma.vetAppointment.findMany({
      where: {
        status: VetAppointmentStatus.AWAITING_PAYMENT,
        paymentDeadline: { lt: now }
      },
      include: { vetProfile: { select: { fullName: true } } }
    });

    for (const row of expired) {
      assertTransition(row.status, "PAYMENT_EXPIRED");
      await this.prisma.vetAppointment.update({
        where: { id: row.id },
        data: { status: VetAppointmentStatus.PAYMENT_EXPIRED, cancelledAt: now }
      });
      const when = this.formatWhen(row.confirmedAt ?? row.requestedAt);
      const vetName = row.vetProfile?.fullName ?? "le vétérinaire";
      await this.push.sendToUser(
        row.producerUserId,
        "RDV expiré",
        `Votre RDV avec Dr ${vetName} le ${when} a expiré faute de paiement.`,
        { type: "vet_appointment_payment_expired", appointmentId: row.id }
      );
      await this.push.sendToUser(
        row.vetUserId,
        "RDV annulé",
        "Le producteur n'a pas payé — RDV annulé automatiquement.",
        { type: "vet_appointment_payment_expired_vet", appointmentId: row.id }
      );
    }
    return expired.length;
  }

  /** VISIT_PROPOSED sans réponse producteur après 72h → expiration. */
  async handleExpiredProposals(): Promise<number> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - PROPOSAL_EXPIRY_HOURS);

    const expired = await this.prisma.vetAppointment.findMany({
      where: {
        status: VetAppointmentStatus.VISIT_PROPOSED,
        proposedByVetAt: { lt: cutoff }
      },
      include: {
        vetProfile: { select: { fullName: true } },
        producer: { select: { fullName: true } },
        farm: { select: { name: true } }
      }
    });

    const now = new Date();
    for (const row of expired) {
      assertTransition(row.status, "PROPOSAL_EXPIRED");
      await this.prisma.vetAppointment.update({
        where: { id: row.id },
        data: {
          status: VetAppointmentStatus.PAYMENT_EXPIRED,
          cancelledAt: now,
          cancellationReason: "Proposition expirée (72h sans réponse)"
        }
      });
      const when = this.formatWhen(row.confirmedAt ?? row.requestedAt);
      const vetName = row.vetProfile?.fullName ?? "le vétérinaire";
      const producerName = row.producer?.fullName?.trim() || "Le producteur";
      await this.push.sendToUser(
        row.producerUserId,
        "Proposition expirée",
        `La proposition de visite de Dr ${vetName} le ${when} a expiré faute de réponse.`,
        { type: "vet_appointment_proposal_expired", appointmentId: row.id }
      );
      await this.push.sendToUser(
        row.vetUserId,
        "Proposition expirée",
        `${producerName} n'a pas répondu — proposition du ${when} expirée.`,
        { type: "vet_appointment_proposal_expired_vet", appointmentId: row.id }
      );
    }
    return expired.length;
  }

  async sendUpcomingReminders(): Promise<number> {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const inOneHourFive = new Date(now.getTime() + 65 * 60 * 1000);

    const upcoming = await this.prisma.vetAppointment.findMany({
      where: {
        status: VetAppointmentStatus.APPOINTMENT_CONFIRMED,
        confirmedAt: { gte: inOneHour, lte: inOneHourFive }
      },
      include: {
        farm: { select: { name: true } },
        vetProfile: { select: { fullName: true } },
        producer: { select: { fullName: true } }
      }
    });

    for (const row of upcoming) {
      const when = this.formatWhen(row.confirmedAt!);
      const body = `Rappel: RDV dans 1h — ${when} à ${row.farmLocation}`;
      await this.push.sendToUser(row.vetUserId, "Rappel RDV", body, {
        type: "vet_appointment_reminder",
        appointmentId: row.id
      });
      await this.push.sendToUser(row.producerUserId, "Rappel RDV", body, {
        type: "vet_appointment_reminder",
        appointmentId: row.id
      });
    }
    return upcoming.length;
  }

  async getAdminRevenue(period?: string) {
    const now = new Date();
    let since: Date | null = null;
    if (period === "7d") {
      since = new Date(now.getTime() - 7 * 86400000);
    } else if (period === "30d") {
      since = new Date(now.getTime() - 30 * 86400000);
    } else if (period === "90d") {
      since = new Date(now.getTime() - 90 * 86400000);
    }

    const where = {
      type: "APPOINTMENT_COMMISSION",
      ...(since ? { collectedAt: { gte: since } } : {})
    };

    const [agg, rows, lowRated] = await Promise.all([
      this.prisma.platformRevenue.aggregate({
        where,
        _sum: { commissionAmount: true, grossAmount: true },
        _count: true
      }),
      this.prisma.platformRevenue.findMany({
        where,
        orderBy: { collectedAt: "desc" },
        take: 20,
        include: {
          vetAppointment: {
            include: {
              farm: { select: { name: true } },
              vetProfile: { select: { fullName: true } }
            }
          }
        }
      }),
      this.prisma.vetProfile.findMany({
        where: {
          ratingCount: { gte: 3 },
          ratingAvg: { lt: 3 }
        },
        orderBy: { ratingAvg: "asc" },
        take: 10,
        select: {
          id: true,
          fullName: true,
          ratingAvg: true,
          ratingCount: true,
          completedAppointments: true
        }
      })
    ]);

    return {
      period: period ?? "all",
      totalCommission: Number(agg._sum.commissionAmount ?? 0),
      totalGross: Number(agg._sum.grossAmount ?? 0),
      appointmentCount: agg._count,
      recent: rows.map((r) => ({
        id: r.id,
        appointmentId: r.vetAppointmentId,
        farmName: r.vetAppointment?.farm.name ?? "—",
        vetName: r.vetAppointment?.vetProfile.fullName ?? "—",
        commissionAmount: Number(r.commissionAmount),
        grossAmount: Number(r.grossAmount),
        collectedAt: r.collectedAt.toISOString()
      })),
      lowRatedVets: lowRated.map((v) => ({
        id: v.id,
        fullName: v.fullName,
        ratingAvg: v.ratingAvg != null ? Number(v.ratingAvg) : null,
        ratingCount: v.ratingCount,
        completedAppointments: v.completedAppointments
      }))
    };
  }

  async listForAdmin(status?: string) {
    const where = status?.trim()
      ? { status: status.trim() as VetAppointmentStatus }
      : {};
    const rows = await this.prisma.vetAppointment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: VET_APPOINTMENT_INCLUDE
    });
    return rows.map((r) => this.mapRow(r));
  }

  private async refundProducerToWallet(
    appointmentId: string,
    producerUserId: string,
    amount: number,
    currency: string,
    note: string,
    idempotencySuffix: string
  ): Promise<void> {
    if (amount <= 0) {
      return;
    }
    await this.userWallet.creditVetRefund(
      producerUserId,
      amount,
      currency,
      appointmentId,
      note,
      `vet-refund:${appointmentId}:${idempotencySuffix}`
    );
    await this.prisma.vetAppointmentFundMovement.create({
      data: {
        appointmentId,
        kind: VetAppointmentFundMovementKind.REFUND_PRODUCER,
        amount: new Prisma.Decimal(amount),
        currency,
        note
      }
    });
  }

  async adminManualRefund(appointmentId: string, amount?: number) {
    const row = await this.prisma.vetAppointment.findUnique({
      where: { id: appointmentId },
      include: { producer: true }
    });
    if (!row) {
      throw new NotFoundException("Rendez-vous introuvable");
    }
    const refundAmount =
      amount ?? Number(row.blockedAmount ?? row.servicePrice ?? 0);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      throw new BadRequestException("Montant remboursement invalide");
    }
    await this.refundProducerToWallet(
      appointmentId,
      row.producerUserId,
      refundAmount,
      row.currency,
      "Remboursement manuel admin",
      "admin-manual"
    );
    if (row.calendarBlocked) {
      await this.calendar.unblockSlot(this.prisma, appointmentId);
    }
    return { ok: true, refundAmount };
  }

  private async requireVetAppointment(
    vetUserId: string,
    appointmentId: string,
    allowed: VetAppointmentStatus[]
  ) {
    const row = await this.prisma.vetAppointment.findUnique({
      where: { id: appointmentId },
      include: { farm: { select: { name: true } }, vetProfile: true }
    });
    if (!row || row.vetUserId !== vetUserId) {
      throw new NotFoundException("Rendez-vous introuvable");
    }
    if (!allowed.includes(row.status)) {
      throw new BadRequestException(
        `Action impossible pour le statut ${row.status}`
      );
    }
    return row;
  }

  private async requireProducerAppointment(
    producerUserId: string,
    appointmentId: string,
    allowed: VetAppointmentStatus[]
  ) {
    const row = await this.prisma.vetAppointment.findUnique({
      where: { id: appointmentId },
      include: {
        farm: { select: { name: true } },
        vetProfile: true,
        producer: true,
        rating: true
      }
    });
    if (!row || row.producerUserId !== producerUserId) {
      throw new NotFoundException("Rendez-vous introuvable");
    }
    if (!allowed.includes(row.status)) {
      throw new BadRequestException(
        `Action impossible pour le statut ${row.status}`
      );
    }
    return row;
  }
}

export { RATING_TAGS };
