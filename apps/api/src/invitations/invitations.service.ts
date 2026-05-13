import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import type { Prisma as PrismaTypes, User } from "@prisma/client";
import {
  FarmInvitationKind,
  FarmInvitationStatus,
  MembershipRole,
  Prisma
} from "@prisma/client";
import { randomBytes } from "crypto";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateFarmInvitationDto,
  InvitationPermissionsDto
} from "./dto/create-farm-invitation.dto";
import { RespondInvitationDto } from "./dto/respond-invitation.dto";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_LINK_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const SCAN_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Mappe les permissions UI (`InvitationPermissionsDto`) vers les `scopes`
 * stockés sur `FarmMembership.scopes`. Le rôle reste la source d'autorité
 * (RBAC effectif via `FarmAccessService`), mais l'invitation enregistre
 * la vue UI dans `permissions` pour rappel.
 */
function permissionsToScopes(
  permissions: InvitationPermissionsDto | undefined,
  role: MembershipRole | null | undefined
): string[] {
  if (!permissions) {
    return [];
  }
  const scopes = new Set<string>();
  if (permissions.readOnly) {
    scopes.add(FARM_SCOPE.livestockRead);
    scopes.add(FARM_SCOPE.tasksRead);
    scopes.add(FARM_SCOPE.healthRead);
    scopes.add(FARM_SCOPE.housingRead);
    scopes.add(FARM_SCOPE.exitsRead);
    scopes.add(FARM_SCOPE.vetRead);
    scopes.add(FARM_SCOPE.marketplaceRead);
    scopes.add(FARM_SCOPE.chat);
  }
  if (permissions.dataEntry) {
    scopes.add(FARM_SCOPE.livestockRead);
    scopes.add(FARM_SCOPE.livestockWrite);
    scopes.add(FARM_SCOPE.tasksRead);
    scopes.add(FARM_SCOPE.tasksWrite);
    scopes.add(FARM_SCOPE.housingRead);
    scopes.add(FARM_SCOPE.housingWrite);
    scopes.add(FARM_SCOPE.exitsRead);
    scopes.add(FARM_SCOPE.exitsWrite);
    scopes.add(FARM_SCOPE.chat);
  }
  if (permissions.health) {
    scopes.add(FARM_SCOPE.healthRead);
    scopes.add(FARM_SCOPE.healthWrite);
    scopes.add(FARM_SCOPE.vetRead);
    scopes.add(FARM_SCOPE.vetWrite);
    scopes.add(FARM_SCOPE.livestockRead);
    scopes.add(FARM_SCOPE.chat);
  }
  if (permissions.finance) {
    scopes.add(FARM_SCOPE.financeRead);
    scopes.add(FARM_SCOPE.financeWrite);
  }
  if (role === MembershipRole.veterinarian) {
    scopes.add(FARM_SCOPE.vetRead);
    scopes.add(FARM_SCOPE.vetWrite);
    scopes.add(FARM_SCOPE.healthRead);
    scopes.add(FARM_SCOPE.healthWrite);
  }
  return Array.from(scopes).sort();
}

/** Étiquette UI (mobile) → rôle RBAC API. */
function recipientKindToRole(
  recipientKind: string | null | undefined
): MembershipRole | null {
  switch (recipientKind) {
    case "veterinarian":
      return MembershipRole.veterinarian;
    case "technician":
      return MembershipRole.worker;
    case "partner":
      return MembershipRole.viewer;
    default:
      return null;
  }
}

function generateToken(): string {
  return randomBytes(24).toString("hex");
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly farmAccess: FarmAccessService
  ) {}

  /**
   * Lien collaboratif par défaut (kind=share_link, isDefault=true) pour une ferme.
   * Créé à la volée s'il manque (ex. fermes existantes avant migration).
   */
  async ensureDefaultInvitation(actor: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(actor.id, farmId);
    const existing = await this.prisma.farmInvitation.findFirst({
      where: {
        farmId,
        isDefault: true,
        status: FarmInvitationStatus.pending
      },
      orderBy: { createdAt: "desc" }
    });
    if (
      existing &&
      existing.expiresAt.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000
    ) {
      return existing;
    }
    return this.createDefaultInvitation(this.prisma, farmId, actor.id);
  }

  /**
   * Création du lien collaboratif par défaut. Idempotent par ferme — appelé
   * par `FarmsService.create` dans la même transaction (`tx` est soit le
   * client racine, soit un `TransactionClient`).
   */
  async createDefaultInvitation(
    tx: Prisma.TransactionClient,
    farmId: string,
    createdById: string
  ) {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + DEFAULT_LINK_TTL_MS);
    const inv = await tx.farmInvitation.create({
      data: {
        farmId,
        createdById,
        token,
        expiresAt,
        kind: FarmInvitationKind.share_link,
        status: FarmInvitationStatus.pending,
        isDefault: true,
        permissions: Prisma.JsonNull,
        scopes: []
      }
    });
    return inv;
  }

  /**
   * Liste les invitations actives (kind=share_link en attente) + demandes scan_request en attente.
   * Réservée aux gestionnaires d'invitations.
   */
  async listPendingInvitations(actor: User, farmId: string) {
    await this.farmAccess.requireFarmScopes(actor.id, farmId, [
      FARM_SCOPE.invitationsManage
    ]);
    return this.prisma.farmInvitation.findMany({
      where: {
        farmId,
        status: FarmInvitationStatus.pending
      },
      orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        farmId: true,
        role: true,
        scopes: true,
        expiresAt: true,
        inviteeEmail: true,
        inviteePhone: true,
        createdAt: true,
        createdById: true,
        kind: true,
        status: true,
        isDefault: true,
        permissions: true,
        recipientKind: true,
        scannedByUserId: true,
        scannedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        }
      }
    });
  }

  async createInvitation(
    user: User,
    farmId: string,
    dto: CreateFarmInvitationDto
  ) {
    if (dto.role === MembershipRole.owner) {
      throw new BadRequestException(
        "Le role owner ne peut pas etre attribue par invitation"
      );
    }

    const resolvedRole: MembershipRole | null =
      dto.role ?? recipientKindToRole(dto.recipientKind);

    if (!resolvedRole) {
      throw new BadRequestException(
        "Un role (ou recipientKind) est requis pour creer une invitation"
      );
    }

    const explicitScopes = dto.scopes ?? [];
    const derivedScopes = permissionsToScopes(dto.permissions, resolvedRole);
    const scopes = explicitScopes.length > 0 ? explicitScopes : derivedScopes;

    const token = generateToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const inv = await this.prisma.farmInvitation.create({
      data: {
        farmId,
        createdById: user.id,
        role: resolvedRole,
        scopes,
        token,
        expiresAt,
        inviteeEmail: dto.inviteeEmail,
        inviteePhone: dto.inviteePhone,
        kind: FarmInvitationKind.share_link,
        status: FarmInvitationStatus.pending,
        recipientKind: dto.recipientKind ?? null,
        permissions: (dto.permissions ?? null) as PrismaTypes.InputJsonValue
      }
    });

    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.farmInvitationCreated,
      resourceType: "FarmInvitation",
      resourceId: inv.id,
      metadata: {
        role: inv.role,
        scopes: inv.scopes,
        recipientKind: inv.recipientKind ?? undefined,
        permissions: inv.permissions ?? undefined,
        inviteeEmail: inv.inviteeEmail ?? undefined,
        inviteePhone: inv.inviteePhone ?? undefined
      }
    });

    return {
      id: inv.id,
      farmId: inv.farmId,
      role: inv.role,
      scopes: inv.scopes,
      recipientKind: inv.recipientKind,
      permissions: inv.permissions,
      expiresAt: inv.expiresAt,
      token,
      isDefault: inv.isDefault
    };
  }

  /**
   * Aperçu public (auth requise mais sans scopes) d'une invitation par token.
   * Utilisé après deep link / scan QR : renvoie un libellé ferme + métadonnées
   * sans fuiter d'infos sensibles. Pour les liens par défaut, crée une demande
   * `scan_request` au passage si le scanner n'est ni owner ni déjà membre.
   */
  async previewInvitationByToken(viewer: User, rawToken: string) {
    const token = rawToken.trim();
    if (!token) {
      throw new BadRequestException("Jeton manquant");
    }
    const inv = await this.prisma.farmInvitation.findUnique({
      where: { token },
      include: {
        farm: {
          select: { id: true, name: true, speciesFocus: true }
        }
      }
    });
    if (!inv) {
      throw new NotFoundException("Invitation introuvable");
    }
    if (inv.status === FarmInvitationStatus.rejected) {
      throw new GoneException("Invitation refusee");
    }
    if (
      inv.status === FarmInvitationStatus.expired ||
      inv.expiresAt.getTime() < Date.now()
    ) {
      if (inv.status !== FarmInvitationStatus.expired) {
        await this.prisma.farmInvitation
          .update({
            where: { id: inv.id },
            data: { status: FarmInvitationStatus.expired }
          })
          .catch(() => undefined);
      }
      throw new GoneException("Invitation expiree");
    }

    const isOwner = inv.farm
      ? await this.prisma.farm.findFirst({
          where: { id: inv.farmId, ownerId: viewer.id },
          select: { id: true }
        })
      : null;

    const existingMembership = await this.prisma.farmMembership.findFirst({
      where: { farmId: inv.farmId, userId: viewer.id }
    });

    let scanRequestId: string | null = null;

    if (
      inv.kind === FarmInvitationKind.share_link &&
      inv.isDefault &&
      !isOwner &&
      !existingMembership &&
      inv.createdById !== viewer.id
    ) {
      const existingPending = await this.prisma.farmInvitation.findFirst({
        where: {
          farmId: inv.farmId,
          kind: FarmInvitationKind.scan_request,
          status: FarmInvitationStatus.pending,
          scannedByUserId: viewer.id
        }
      });
      if (existingPending) {
        scanRequestId = existingPending.id;
      } else {
        const scanReq = await this.prisma.farmInvitation.create({
          data: {
            farmId: inv.farmId,
            createdById: inv.createdById,
            scannedByUserId: viewer.id,
            kind: FarmInvitationKind.scan_request,
            status: FarmInvitationStatus.pending,
            token: generateToken(),
            expiresAt: new Date(Date.now() + SCAN_REQUEST_TTL_MS),
            scopes: []
          }
        });
        scanRequestId = scanReq.id;
        await this.audit.record({
          actorUserId: viewer.id,
          farmId: inv.farmId,
          action: AUDIT_ACTION.farmInvitationScanRequested,
          resourceType: "FarmInvitation",
          resourceId: scanReq.id,
          metadata: {
            parentInvitationId: inv.id,
            isDefaultLink: true
          }
        });
        await this.maybeNotifyOwnerOfScanRequest(
          inv.farmId,
          inv.createdById,
          viewer,
          scanReq.id
        ).catch((err) => {
          this.logger.warn(
            `notification scan_request non delivree: ${err instanceof Error ? err.message : String(err)}`
          );
        });
      }
    }

    return {
      token: inv.token,
      farmId: inv.farmId,
      farmName: inv.farm.name,
      kind: inv.kind,
      status: inv.status,
      isDefault: inv.isDefault,
      role: inv.role,
      scopes: inv.scopes,
      permissions: inv.permissions,
      recipientKind: inv.recipientKind,
      expiresAt: inv.expiresAt,
      isOwner: Boolean(isOwner),
      alreadyMember: Boolean(existingMembership),
      pendingScanRequestId: scanRequestId
    };
  }

  /**
   * Reponse owner à une demande `scan_request` (ou validation d'un share_link cible).
   * Pour `accept=true` : crée la FarmMembership avec rôle + permissions transmis.
   */
  async respondToInvitation(
    actor: User,
    invitationId: string,
    dto: RespondInvitationDto
  ) {
    const invitation = await this.prisma.farmInvitation.findUnique({
      where: { id: invitationId }
    });
    if (!invitation) {
      throw new NotFoundException("Invitation introuvable");
    }
    await this.farmAccess.requireFarmScopes(actor.id, invitation.farmId, [
      FARM_SCOPE.invitationsManage
    ]);
    if (invitation.status !== FarmInvitationStatus.pending) {
      throw new ConflictException("Invitation deja traitee");
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.prisma.farmInvitation.update({
        where: { id: invitation.id },
        data: { status: FarmInvitationStatus.expired }
      });
      throw new GoneException("Invitation expiree");
    }
    if (invitation.isDefault) {
      throw new BadRequestException(
        "Le lien par defaut ne peut pas etre cloture ; gerer les demandes scan_request"
      );
    }

    if (!dto.accept) {
      const updated = await this.prisma.farmInvitation.update({
        where: { id: invitation.id },
        data: {
          status: FarmInvitationStatus.rejected,
          rejectedAt: new Date()
        }
      });
      await this.audit.record({
        actorUserId: actor.id,
        farmId: invitation.farmId,
        action: AUDIT_ACTION.farmInvitationRejected,
        resourceType: "FarmInvitation",
        resourceId: invitation.id,
        metadata: { kind: invitation.kind }
      });
      return {
        ok: true,
        invitationId: updated.id,
        farmId: updated.farmId,
        status: updated.status
      };
    }

    const role = dto.recipientRole ?? invitation.role;
    if (!role) {
      throw new BadRequestException(
        "recipientRole requis pour accepter cette demande"
      );
    }
    if (role === MembershipRole.owner) {
      throw new BadRequestException(
        "Le role owner ne peut pas etre attribue par invitation"
      );
    }

    const permissions = dto.permissions ?? null;
    const derivedScopes = permissionsToScopes(
      dto.permissions ?? undefined,
      role
    );
    const scopes =
      invitation.scopes.length > 0 ? invitation.scopes : derivedScopes;

    if (
      invitation.kind === FarmInvitationKind.scan_request &&
      !invitation.scannedByUserId
    ) {
      throw new BadRequestException(
        "Demande de scan invalide (aucun utilisateur identifie)"
      );
    }

    const targetUserId =
      invitation.kind === FarmInvitationKind.scan_request
        ? invitation.scannedByUserId
        : invitation.redeemedByUserId;

    const result = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.farmInvitation.findUnique({
        where: { id: invitation.id }
      });
      if (!fresh || fresh.status !== FarmInvitationStatus.pending) {
        throw new ConflictException("Invitation deja traitee");
      }
      if (fresh.expiresAt.getTime() < Date.now()) {
        throw new GoneException("Invitation expiree");
      }

      if (targetUserId) {
        const existing = await tx.farmMembership.findFirst({
          where: { farmId: fresh.farmId, userId: targetUserId, role }
        });
        if (!existing) {
          try {
            await tx.farmMembership.create({
              data: {
                farmId: fresh.farmId,
                userId: targetUserId,
                role,
                scopes
              }
            });
          } catch (e) {
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === "P2002"
            ) {
              // membership concurrent : ignore
            } else {
              throw e;
            }
          }
        }
      }

      const updated = await tx.farmInvitation.update({
        where: { id: fresh.id },
        data: {
          status: FarmInvitationStatus.accepted,
          acceptedAt: new Date(),
          role,
          scopes,
          permissions: (permissions ?? null) as PrismaTypes.InputJsonValue,
          redeemedAt: new Date(),
          redeemedByUserId: targetUserId ?? null
        }
      });
      return updated;
    });

    await this.audit.record({
      actorUserId: actor.id,
      farmId: invitation.farmId,
      action: AUDIT_ACTION.farmInvitationAccepted,
      resourceType: "FarmInvitation",
      resourceId: invitation.id,
      metadata: {
        kind: invitation.kind,
        role,
        scopes,
        targetUserId: targetUserId ?? undefined
      }
    });

    return {
      ok: true,
      invitationId: result.id,
      farmId: result.farmId,
      role: result.role,
      status: result.status
    };
  }

  /**
   * Flux historique : utilisateur cible se rattache à la ferme via le token
   * (kind=share_link avec un rôle déjà attribué). Refuse les liens par défaut
   * et les demandes scan_request (gérées par l'owner via respondToInvitation).
   */
  async accept(user: User, body: { token: string }) {
    const inv = await this.prisma.farmInvitation.findUnique({
      where: { token: body.token.trim() }
    });
    if (!inv) {
      throw new NotFoundException("Invitation introuvable");
    }
    if (inv.expiresAt.getTime() < Date.now()) {
      throw new GoneException("Invitation expiree");
    }
    if (inv.status === FarmInvitationStatus.rejected) {
      throw new GoneException("Invitation refusee");
    }
    if (inv.status !== FarmInvitationStatus.pending) {
      throw new BadRequestException("Invitation deja utilisee");
    }
    if (inv.kind === FarmInvitationKind.scan_request) {
      throw new BadRequestException(
        "Cette demande doit etre validee par le proprietaire de la ferme"
      );
    }
    if (inv.isDefault) {
      throw new BadRequestException(
        "Lien par defaut : la demande doit etre validee par le proprietaire"
      );
    }
    if (!inv.role) {
      throw new BadRequestException(
        "Invitation incomplete : role manquant"
      );
    }

    const role = inv.role;

    const result = await this.prisma.$transaction(async (tx) => {
      const row = await tx.farmInvitation.findUnique({
        where: { id: inv.id }
      });
      if (!row || row.status !== FarmInvitationStatus.pending) {
        throw new BadRequestException("Invitation deja utilisee");
      }
      if (row.expiresAt.getTime() < Date.now()) {
        throw new GoneException("Invitation expiree");
      }

      const existing = await tx.farmMembership.findFirst({
        where: {
          farmId: row.farmId,
          userId: user.id,
          role
        }
      });

      if (!existing) {
        try {
          await tx.farmMembership.create({
            data: {
              farmId: row.farmId,
              userId: user.id,
              role,
              scopes: row.scopes
            }
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          ) {
            // concurrent accept
          } else {
            throw e;
          }
        }
      }

      await tx.farmInvitation.update({
        where: { id: row.id },
        data: {
          status: FarmInvitationStatus.accepted,
          acceptedAt: new Date(),
          redeemedAt: new Date(),
          redeemedByUserId: user.id
        }
      });

      return {
        ok: true,
        farmId: row.farmId,
        role,
        alreadyMember: Boolean(existing),
        invitationId: row.id
      };
    });

    await this.audit.record({
      actorUserId: user.id,
      farmId: result.farmId,
      action: AUDIT_ACTION.farmInvitationAccepted,
      resourceType: "FarmInvitation",
      resourceId: result.invitationId,
      metadata: {
        role: result.role,
        alreadyMember: result.alreadyMember
      }
    });

    return {
      ok: result.ok,
      farmId: result.farmId,
      role: result.role,
      alreadyMember: result.alreadyMember
    };
  }

  /**
   * Stub de notification owner. Aujourd'hui : log applicatif uniquement.
   * Quand l'envoi push réel (server → Expo) sera branché, déclencher ici
   * un `pushDevice` lookup + Expo HTTP API. Sécurité : ne pas exposer
   * d'infos du scanner au-delà du fullName/email.
   */
  private async maybeNotifyOwnerOfScanRequest(
    farmId: string,
    ownerUserId: string,
    scanner: User,
    scanRequestId: string
  ): Promise<void> {
    const devices = await this.prisma.pushDevice.findMany({
      where: { userId: ownerUserId }
    });
    if (devices.length === 0) {
      this.logger.log(
        `[invitations] scan_request ${scanRequestId} (farm ${farmId}) — owner ${ownerUserId} sans pushDevice (notification differee).`
      );
      return;
    }
    this.logger.log(
      `[invitations] scan_request ${scanRequestId} (farm ${farmId}) — ${devices.length} pushDevice(s) eligible(s), demandeur=${scanner.id}. Envoi push NON CABLE (TODO Expo HTTP).`
    );
  }
}
