import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { ChatRoomKind } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";

function directKeyForPair(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join("_");
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService
  ) {}

  async assertRoomMember(userId: string, roomId: string) {
    const m = await this.prisma.chatRoomMember.findFirst({
      where: { roomId, userId }
    });
    if (!m) {
      throw new ForbiddenException("Acces au salon refuse");
    }
  }

  async ensureFarmRoom(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    let room = await this.prisma.chatRoom.findUnique({
      where: { farmId }
    });
    if (!room) {
      room = await this.prisma.chatRoom.create({
        data: {
          kind: ChatRoomKind.farm,
          farmId,
          title: null
        }
      });
    }
    await this.prisma.chatRoomMember.upsert({
      where: {
        roomId_userId: { roomId: room.id, userId: user.id }
      },
      create: { roomId: room.id, userId: user.id },
      update: {}
    });
    return this.getRoomSummary(user.id, room.id);
  }

  async ensureDirectRoom(user: User, peerUserId: string) {
    if (peerUserId === user.id) {
      throw new BadRequestException("Conversation directe invalide");
    }
    const peer = await this.prisma.user.findUnique({
      where: { id: peerUserId }
    });
    if (!peer) {
      throw new NotFoundException("Utilisateur introuvable");
    }
    const key = directKeyForPair(user.id, peerUserId);
    let room = await this.prisma.chatRoom.findUnique({
      where: { directKey: key }
    });
    if (!room) {
      try {
        room = await this.prisma.chatRoom.create({
          data: {
            kind: ChatRoomKind.direct,
            directKey: key,
            title: null,
            members: {
              create: [{ userId: user.id }, { userId: peerUserId }]
            }
          }
        });
      } catch {
        room = await this.prisma.chatRoom.findUnique({
          where: { directKey: key }
        });
        if (!room) {
          throw new BadRequestException("Creation du salon impossible");
        }
      }
    } else {
      await this.prisma.chatRoomMember.upsert({
        where: {
          roomId_userId: { roomId: room.id, userId: user.id }
        },
        create: { roomId: room.id, userId: user.id },
        update: {}
      });
    }
    return this.getRoomSummary(user.id, room.id);
  }

  private async getRoomSummary(forUserId: string, roomId: string) {
    const room = await this.prisma.chatRoom.findFirst({
      where: { id: roomId },
      include: {
        farm: { select: { id: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, fullName: true, email: true } }
          }
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: { id: true, fullName: true } }
          }
        }
      }
    });
    if (!room) {
      throw new NotFoundException("Salon introuvable");
    }
    const isMember = room.members.some((m) => m.userId === forUserId);
    if (!isMember) {
      throw new ForbiddenException("Acces au salon refuse");
    }
    return room;
  }

  async listRooms(user: User) {
    const memberships = await this.prisma.chatRoomMember.findMany({
      where: { userId: user.id },
      include: {
        room: {
          include: {
            farm: { select: { id: true, name: true } },
            members: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true }
                }
              }
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                sender: { select: { id: true, fullName: true } }
              }
            }
          }
        }
      },
      orderBy: { joinedAt: "desc" }
    });
    return memberships.map((m) => m.room);
  }

  async getRoom(user: User, roomId: string) {
    await this.assertRoomMember(user.id, roomId);
    return this.getRoomSummary(user.id, roomId);
  }

  async listMessages(user: User, roomId: string, cursor?: string, take = 50) {
    await this.assertRoomMember(user.id, roomId);
    const lim = Math.min(Math.max(take, 1), 100);
    if (cursor) {
      const ref = await this.prisma.chatMessage.findFirst({
        where: { id: cursor, roomId }
      });
      if (!ref) {
        throw new BadRequestException("Curseur invalide");
      }
      return this.prisma.chatMessage.findMany({
        where: {
          roomId,
          OR: [
            { createdAt: { lt: ref.createdAt } },
            {
              AND: [
                { createdAt: ref.createdAt },
                { id: { lt: ref.id } }
              ]
            }
          ]
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: lim,
        include: {
          sender: { select: { id: true, fullName: true, email: true } }
        }
      });
    }
    return this.prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: lim,
      include: {
        sender: { select: { id: true, fullName: true, email: true } }
      }
    });
  }

  async createMessage(senderId: string, roomId: string, body: string) {
    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException("Message vide");
    }
    await this.assertRoomMember(senderId, roomId);
    return this.prisma.chatMessage.create({
      data: {
        roomId,
        senderUserId: senderId,
        body: trimmed
      },
      include: {
        sender: { select: { id: true, fullName: true, email: true } }
      }
    });
  }

  /**
   * Annuaire pour DM : uniquement les utilisateurs avec au moins une ferme en commun
   * (propriétaire ou membre), + recherche par fragment de nom ou d’e-mail (hors soi).
   */
  async searchUsersForChat(actor: User, rawQ: string) {
    const q = rawQ.trim();
    if (q.length < 2) {
      throw new BadRequestException(
        "Requete trop courte (minimum 2 caracteres)"
      );
    }

    const myFarms = await this.prisma.farm.findMany({
      where: {
        OR: [
          { ownerId: actor.id },
          { memberships: { some: { userId: actor.id } } }
        ]
      },
      select: { id: true }
    });
    const farmIds = myFarms.map((f) => f.id);
    if (farmIds.length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        id: { not: actor.id },
        AND: [
          {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { fullName: { contains: q, mode: "insensitive" } }
            ]
          },
          {
            OR: [
              { ownedFarms: { some: { id: { in: farmIds } } } },
              { memberships: { some: { farmId: { in: farmIds } } } }
            ]
          }
        ]
      },
      select: {
        id: true,
        fullName: true,
        email: true
      },
      take: 20,
      orderBy: [{ fullName: "asc" }, { email: "asc" }]
    });
  }
}
