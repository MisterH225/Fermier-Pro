import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { MembershipRole, Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { PrismaService } from "../prisma/prisma.service";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { CreateFarmInvitationDto } from "./dto/create-farm-invitation.dto";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly farmAccess: FarmAccessService
  ) {}

  /** Invitations en attente (non utilisées), réservées aux gestionnaires d’invitations. */
  async listPendingInvitations(actor: User, farmId: string) {
    await this.farmAccess.requireFarmScopes(actor.id, farmId, [
      FARM_SCOPE.invitationsManage
    ]);
    return this.prisma.farmInvitation.findMany({
      where: { farmId, redeemedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        farmId: true,
        role: true,
        scopes: true,
        expiresAt: true,
        inviteeEmail: true,
        inviteePhone: true,
        createdAt: true,
        createdById: true
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

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const inv = await this.prisma.farmInvitation.create({
      data: {
        farmId,
        createdById: user.id,
        role: dto.role,
        scopes: dto.scopes ?? [],
        token,
        expiresAt,
        inviteeEmail: dto.inviteeEmail,
        inviteePhone: dto.inviteePhone
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
        inviteeEmail: inv.inviteeEmail ?? undefined,
        inviteePhone: inv.inviteePhone ?? undefined
      }
    });

    return {
      id: inv.id,
      farmId: inv.farmId,
      role: inv.role,
      expiresAt: inv.expiresAt,
      token
    };
  }

  async accept(user: User, dto: AcceptInvitationDto) {
    const inv = await this.prisma.farmInvitation.findUnique({
      where: { token: dto.token.trim() }
    });
    if (!inv) {
      throw new NotFoundException("Invitation introuvable");
    }
    if (inv.expiresAt.getTime() < Date.now()) {
      throw new GoneException("Invitation expiree");
    }
    if (inv.redeemedAt) {
      throw new BadRequestException("Invitation deja utilisee");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const row = await tx.farmInvitation.findUnique({
        where: { id: inv.id }
      });
      if (!row || row.redeemedAt) {
        throw new BadRequestException("Invitation deja utilisee");
      }
      if (row.expiresAt.getTime() < Date.now()) {
        throw new GoneException("Invitation expiree");
      }

      const existing = await tx.farmMembership.findFirst({
        where: {
          farmId: row.farmId,
          userId: user.id,
          role: row.role
        }
      });

      if (!existing) {
        try {
          await tx.farmMembership.create({
            data: {
              farmId: row.farmId,
              userId: user.id,
              role: row.role,
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
          redeemedAt: new Date(),
          redeemedByUserId: user.id
        }
      });

      return {
        ok: true,
        farmId: row.farmId,
        role: row.role,
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
}
