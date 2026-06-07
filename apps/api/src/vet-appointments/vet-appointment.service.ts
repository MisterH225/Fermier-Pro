import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { User } from "@prisma/client";
import {
  Prisma,
  VetAppointmentFundMovementKind,
  VetAppointmentStatus,
  VetVerificationStatus
} from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import {
  MOBILE_MONEY_GATEWAY,
  type MobileMoneyGateway
} from "../marketplace/escrow/mobile-money.gateway";
import { VetCalendarService } from "./vet-calendar.service";

const PAYMENT_DEADLINE_HOURS = 24;
const RATING_TAGS = [
  "Ponctuel",
  "Professionnel",
  "Bon diagnostic",
  "Prix raisonnable"
] as const;

const ACTIVE_CALENDAR_STATUSES: VetAppointmentStatus[] = [
  VetAppointmentStatus.APPOINTMENT_CONFIRMED,
  VetAppointmentStatus.APPOINTMENT_IN_PROGRESS
];

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
    private readonly calendar: VetCalendarService,
    private readonly config: ConfigService,
    @Inject(MOBILE_MONEY_GATEWAY)
    private readonly gateway: MobileMoneyGateway
  ) {}

  private commissionRate(): number {
    const raw = this.config.get<string>("PLATFORM_COMMISSION_RATE") ?? "0.05";
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n >= 0 && n < 1 ? n : 0.05;
  }

  private cancellationPartialRate(): number {
    const raw =
      this.config.get<string>("VET_APPOINTMENT_CANCELLATION_PARTIAL_RATE") ??
      "0.5";
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.5;
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
      blockedAmount:
        row.blockedAmount != null ? Number(row.blockedAmount) : null,
      paymentDeadline: row.paymentDeadline?.toISOString() ?? null,
      paymentConfirmedAt: row.paymentConfirmedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
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
        commissionRate: new Prisma.Decimal(this.commissionRate()),
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

    return this.mapRow(row);
  }

  /**
   * Planification initiée par le vétérinaire (remplace VetConsultation scheduled_visit).
   * Avec tarif → AWAITING_PAYMENT ; sans tarif → APPOINTMENT_CONFIRMED + calendrier bloqué.
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

    const conflict = await this.calendar.detectConflicts(vetUserId, requestedAt);
    const farmLocation =
      farm.address?.trim() || farm.name?.trim() || "—";
    const duration = 1;
    const hasPrice =
      input.servicePrice != null &&
      Number.isFinite(input.servicePrice) &&
      input.servicePrice > 0;

    if (hasPrice) {
      const paymentDeadline = new Date();
      paymentDeadline.setHours(
        paymentDeadline.getHours() + PAYMENT_DEADLINE_HOURS
      );
      const price = input.servicePrice!;

      const row = await this.prisma.vetAppointment.create({
        data: {
          farmId,
          producerUserId: farm.ownerId,
          vetProfileId: vetProfile.id,
          vetUserId,
          status: VetAppointmentStatus.AWAITING_PAYMENT,
          requestedAt,
          confirmedAt: requestedAt,
          estimatedDurationHours: duration,
          reason: input.reason,
          notes: input.notes?.trim() || null,
          farmLocation,
          servicePrice: new Prisma.Decimal(price),
          blockedAmount: new Prisma.Decimal(price),
          paymentDeadline,
          commissionRate: new Prisma.Decimal(this.commissionRate()),
          conflictStatus: conflict.status,
          conflictDetails: conflict.conflictingAppointment
            ? (conflict.conflictingAppointment as Prisma.InputJsonValue)
            : undefined
        },
        include: VET_APPOINTMENT_INCLUDE
      });

      const vetName = row.vetProfile?.fullName ?? "Vétérinaire";
      const when = this.formatWhen(requestedAt);
      const priceFmt = `${Math.round(price).toLocaleString("fr-FR")} FCFA`;

      await this.push.sendToUser(
        farm.ownerId,
        "Visite planifiée — paiement requis",
        `Dr ${vetName} vous propose une visite le ${when}. Montant: ${priceFmt}. Payez avant ${this.formatWhen(paymentDeadline)} pour confirmer.`,
        {
          type: "vet_appointment_accepted",
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
          servicePrice: price
        }
      });

      return this.mapRow(row);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.vetAppointment.create({
        data: {
          farmId,
          producerUserId: farm.ownerId,
          vetProfileId: vetProfile.id,
          vetUserId,
          status: VetAppointmentStatus.APPOINTMENT_CONFIRMED,
          requestedAt,
          confirmedAt: requestedAt,
          estimatedDurationHours: duration,
          reason: input.reason,
          notes: input.notes?.trim() || null,
          farmLocation,
          commissionRate: new Prisma.Decimal(this.commissionRate()),
          conflictStatus: conflict.status,
          conflictDetails: conflict.conflictingAppointment
            ? (conflict.conflictingAppointment as Prisma.InputJsonValue)
            : undefined
        },
        include: VET_APPOINTMENT_INCLUDE
      });
      await this.calendar.blockSlot(
        tx,
        created.id,
        vetUserId,
        requestedAt,
        duration
      );
      return tx.vetAppointment.findUniqueOrThrow({
        where: { id: created.id },
        include: VET_APPOINTMENT_INCLUDE
      });
    });

    const vetName = row.vetProfile?.fullName ?? "Vétérinaire";
    const when = this.formatWhen(requestedAt);
    const producerLabel = farm.owner.fullName?.trim() || "Producteur";

    await this.push.sendToUser(
      farm.ownerId,
      "Visite vétérinaire confirmée",
      `Dr ${vetName} le ${when} — ${farm.name}`,
      {
        type: "vet_appointment_confirmed",
        appointmentId: row.id,
        farmId
      }
    );
    await this.push.sendToUser(
      vetUserId,
      "Visite planifiée",
      `${producerLabel} — ${farm.name} le ${when}`,
      {
        type: "vet_appointment_confirmed",
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
        freeVisit: true
      }
    });

    return this.mapRow(row);
  }

  async listForUser(user: User, role: "producer" | "vet") {
    const where =
      role === "vet"
        ? { vetUserId: user.id }
        : { producerUserId: user.id };

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
    if (
      row.producerUserId !== user.id &&
      row.vetUserId !== user.id
    ) {
      try {
        await this.farmAccess.requireFarmAccess(user.id, row.farmId);
      } catch {
        throw new ForbiddenException("Accès refusé");
      }
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
    const row = await this.requireVetAppointment(vet.id, appointmentId, [
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

  async initiatePayment(producer: User, appointmentId: string) {
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
      data: { paymentProviderRef: init.providerRef }
    });

    return {
      providerRef: init.providerRef,
      amount,
      currency: row.currency,
      paymentUrl: init.paymentUrl ?? null
    };
  }

  async confirmPayment(producer: User, appointmentId: string, providerRef?: string) {
    const row = await this.requireProducerAppointment(producer.id, appointmentId, [
      VetAppointmentStatus.AWAITING_PAYMENT
    ]);

    const ref = providerRef ?? row.paymentProviderRef;
    if (!ref) {
      throw new BadRequestException("Référence paiement manquante");
    }

    const confirmed = await this.gateway.confirmPayment(ref, appointmentId);
    if (!confirmed.success) {
      throw new BadRequestException(
        confirmed.failureReason ?? "Paiement non confirmé"
      );
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
          paymentProviderRef: ref,
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

  async confirmServiceCompletion(producer: User, appointmentId: string) {
    const row = await this.requireProducerAppointment(producer.id, appointmentId, [
      VetAppointmentStatus.APPOINTMENT_CONFIRMED,
      VetAppointmentStatus.APPOINTMENT_IN_PROGRESS
    ]);

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

      return appt;
    });

    void this.gateway
      .releaseFunds({
        amount: vetReceives,
        currency: row.currency,
        recipientUserId: row.vetUserId,
        transactionId: appointmentId,
        label: "Versement prestation vétérinaire"
      })
      .catch((err) => this.log.warn(`release vet payout failed: ${err}`));

    const vetReceivesFmt = `${Math.round(vetReceives).toLocaleString("fr-FR")} FCFA`;
    await this.push.sendToUser(
      updated.vetUserId,
      "Prestation confirmée",
      `Prestation confirmée par ${updated.producer?.fullName ?? "le producteur"}. Virement de ${vetReceivesFmt} en cours.`,
      { type: "vet_appointment_completed", appointmentId }
    );

    return { ...this.mapRow(updated), requiresRating: true };
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

  async cancelByProducer(producer: User, appointmentId: string, reason?: string) {
    const row = await this.requireProducerAppointment(producer.id, appointmentId, [
      VetAppointmentStatus.APPOINTMENT_REQUESTED,
      VetAppointmentStatus.AWAITING_PAYMENT,
      VetAppointmentStatus.APPOINTMENT_CONFIRMED,
      VetAppointmentStatus.APPOINTMENT_IN_PROGRESS
    ]);

    const wasPaid = ACTIVE_CALENDAR_STATUSES.includes(row.status);
    let refundAmount = 0;

    if (wasPaid && row.blockedAmount) {
      const apptTime = (row.confirmedAt ?? row.requestedAt).getTime();
      const hoursUntil = (apptTime - Date.now()) / (60 * 60 * 1000);
      const full = Number(row.blockedAmount);
      refundAmount =
        hoursUntil >= 24
          ? full
          : Math.round(full * this.cancellationPartialRate() * 100) / 100;

      if (refundAmount > 0) {
        await this.gateway.refund({
          amount: refundAmount,
          currency: row.currency,
          buyerUserId: producer.id,
          transactionId: appointmentId,
          originalProviderRef: row.paymentProviderRef
        });
        await this.prisma.vetAppointmentFundMovement.create({
          data: {
            appointmentId,
            kind: VetAppointmentFundMovementKind.REFUND_PRODUCER,
            amount: new Prisma.Decimal(refundAmount),
            currency: row.currency,
            note: "Annulation producteur"
          }
        });
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
          cancellationReason: reason?.trim() || null
        }
      });
    });

    await this.push.sendToUser(
      row.vetUserId,
      "RDV annulé",
      `${producer.fullName?.trim() || "Le producteur"} a annulé sa demande.${
        refundAmount > 0 ? ` Remboursement: ${Math.round(refundAmount).toLocaleString("fr-FR")} FCFA.` : ""
      }`,
      { type: "vet_appointment_cancelled_producer", appointmentId }
    );

    return this.getById(producer, appointmentId);
  }

  async cancelByVet(vet: User, appointmentId: string, reason?: string) {
    const row = await this.requireVetAppointment(vet.id, appointmentId, [
      VetAppointmentStatus.APPOINTMENT_CONFIRMED,
      VetAppointmentStatus.APPOINTMENT_IN_PROGRESS
    ]);

    const refundAmount = Number(row.blockedAmount ?? row.servicePrice ?? 0);
    if (refundAmount > 0) {
      await this.gateway.refund({
        amount: refundAmount,
        currency: row.currency,
        buyerUserId: row.producerUserId,
        transactionId: appointmentId,
        originalProviderRef: row.paymentProviderRef
      });
      await this.prisma.vetAppointmentFundMovement.create({
        data: {
          appointmentId,
          kind: VetAppointmentFundMovementKind.REFUND_PRODUCER,
          amount: new Prisma.Decimal(refundAmount),
          currency: row.currency,
          note: "Annulation vétérinaire — remboursement intégral"
        }
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await this.calendar.unblockSlot(tx, appointmentId);
      await tx.vetAppointment.update({
        where: { id: appointmentId },
        data: {
          status: VetAppointmentStatus.CANCELLED_BY_VET,
          cancelledAt: new Date(),
          cancellationReason: reason?.trim() || null
        }
      });
      await tx.vetProfile.update({
        where: { id: row.vetProfileId },
        data: {
          cancelledAppointmentsAsVet: { increment: 1 }
        }
      });
      await tx.user.update({
        where: { id: vet.id },
        data: { reputationScore: { decrement: 2 } }
      });
    });

    const vetName = row.vetProfile?.fullName ?? "Le vétérinaire";
    await this.push.sendToUser(
      row.producerUserId,
      "RDV annulé",
      `Dr ${vetName} a annulé votre RDV. Remboursement intégral de ${Math.round(refundAmount).toLocaleString("fr-FR")} FCFA sous 24h.`,
      { type: "vet_appointment_cancelled_vet", appointmentId }
    );

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
    await this.gateway.refund({
      amount: refundAmount,
      currency: row.currency,
      buyerUserId: row.producerUserId,
      transactionId: appointmentId,
      originalProviderRef: row.paymentProviderRef
    });
    await this.prisma.vetAppointmentFundMovement.create({
      data: {
        appointmentId,
        kind: VetAppointmentFundMovementKind.REFUND_PRODUCER,
        amount: new Prisma.Decimal(refundAmount),
        currency: row.currency,
        note: "Remboursement manuel admin"
      }
    });
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
