import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { Prisma, User } from "@prisma/client";
import { ChatRoomKind } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildFarmInvitationMessageBody,
  parseFarmInvitationMessageBody,
  type FarmInvitationChatPayload
} from "./chat-invitation-message";
import {
  buildMarketplaceOfferMessageBody,
  marketplaceOfferMessagePreview,
  parseMarketplaceOfferMessageBody,
  type MarketplaceOfferChatPayload
} from "./chat-offer-message";
import { ChatPhoneSecurityService } from "./chat-phone-security.service";

function directKeyForPair(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join("_");
}

const ROOM_LIST_INCLUDE = {
  farm: { select: { id: true, name: true } },
  marketplaceListing: {
    select: {
      id: true,
      title: true,
      category: true,
      currency: true,
      pricePerKg: true,
      photoUrls: true,
      totalWeightKg: true
    }
  },
  members: {
    include: {
      user: { select: { id: true, fullName: true } }
    }
  },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: {
      sender: { select: { id: true, fullName: true } }
    }
  }
} satisfies Prisma.ChatRoomInclude;

type RoomWithListInclude = Prisma.ChatRoomGetPayload<{
  include: typeof ROOM_LIST_INCLUDE;
}>;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly phoneSecurity: ChatPhoneSecurityService
  ) {}

  async assertRoomMember(userId: string, roomId: string) {
    const m = await this.prisma.chatRoomMember.findFirst({
      where: { roomId, userId }
    });
    if (!m) {
      throw new ForbiddenException("Acces au salon refuse");
    }
  }

  private parsePhotoUrls(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return raw.filter((u): u is string => typeof u === "string");
    }
    return [];
  }

  private mapListingSummary(
    listing: RoomWithListInclude["marketplaceListing"]
  ) {
    if (!listing) {
      return null;
    }
    return {
      id: listing.id,
      title: listing.title,
      category: listing.category,
      currency: listing.currency,
      pricePerKg: listing.pricePerKg?.toNumber() ?? null,
      totalWeightKg: listing.totalWeightKg?.toNumber() ?? null,
      photoUrls: this.parsePhotoUrls(listing.photoUrls)
    };
  }

  private mapMessagePreview(
    msg: RoomWithListInclude["messages"][number] | null | undefined
  ) {
    if (!msg) {
      return null;
    }
    const offer = parseMarketplaceOfferMessageBody(msg.body);
    const previewBody = offer
      ? marketplaceOfferMessagePreview(offer)
      : msg.body;
    return {
      id: msg.id,
      body: previewBody,
      createdAt: msg.createdAt,
      sender: {
        id: msg.sender.id,
        fullName: msg.sender.fullName
      }
    };
  }

  private async countUnreadMessages(
    roomId: string,
    userId: string,
    lastReadAt: Date | null | undefined
  ): Promise<number> {
    return this.prisma.chatMessage.count({
      where: {
        roomId,
        senderUserId: { not: userId },
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {})
      }
    });
  }

  private mapRoomForClient(
    room: RoomWithListInclude,
    forUserId: string,
    unreadCount: number
  ) {
    const isMember = room.members.some((m) => m.userId === forUserId);
    if (!isMember) {
      throw new ForbiddenException("Acces au salon refuse");
    }
    const lastMsg = room.messages[0];
    return {
      id: room.id,
      kind: room.kind,
      farmId: room.farmId,
      directKey: room.directKey,
      title: room.title,
      marketplaceListingId: room.marketplaceListingId,
      farm: room.farm,
      marketplaceListing: this.mapListingSummary(room.marketplaceListing),
      unreadCount,
      members: room.members.map((m) => ({
        userId: m.userId,
        user: {
          id: m.user.id,
          fullName: m.user.fullName
        }
      })),
      messages: lastMsg ? [this.mapMessagePreview(lastMsg)!] : []
    };
  }

  private async loadRoomForUser(forUserId: string, roomId: string) {
    const room = await this.prisma.chatRoom.findFirst({
      where: { id: roomId },
      include: ROOM_LIST_INCLUDE
    });
    if (!room) {
      throw new NotFoundException("Salon introuvable");
    }
    const membership = room.members.find((m) => m.userId === forUserId);
    if (!membership) {
      throw new ForbiddenException("Acces au salon refuse");
    }
    const unreadCount = await this.countUnreadMessages(
      room.id,
      forUserId,
      membership.lastReadAt
    );
    return this.mapRoomForClient(room, forUserId, unreadCount);
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
    return this.loadRoomForUser(user.id, room.id);
  }

  async ensureDirectRoom(
    user: User,
    peerUserId: string,
    marketplaceListingId?: string
  ) {
    if (peerUserId === user.id) {
      throw new BadRequestException("Conversation directe invalide");
    }
    const peer = await this.prisma.user.findUnique({
      where: { id: peerUserId }
    });
    if (!peer) {
      throw new NotFoundException("Utilisateur introuvable");
    }

    if (marketplaceListingId) {
      const listing = await this.prisma.marketplaceListing.findUnique({
        where: { id: marketplaceListingId },
        select: { id: true, sellerUserId: true }
      });
      if (!listing) {
        throw new NotFoundException("Annonce introuvable");
      }
      const participants = new Set([listing.sellerUserId, user.id, peerUserId]);
      if (!participants.has(listing.sellerUserId)) {
        throw new BadRequestException("Contexte annonce invalide");
      }
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
            marketplaceListingId: marketplaceListingId ?? null,
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
      if (marketplaceListingId && !room.marketplaceListingId) {
        await this.prisma.chatRoom.update({
          where: { id: room.id },
          data: { marketplaceListingId }
        });
      }
    }
    return this.loadRoomForUser(user.id, room.id);
  }

  async listRooms(user: User) {
    const memberships = await this.prisma.chatRoomMember.findMany({
      where: { userId: user.id },
      include: {
        room: { include: ROOM_LIST_INCLUDE }
      },
      orderBy: { joinedAt: "desc" }
    });

    const mapped = await Promise.all(
      memberships.map(async (m) => {
        const unreadCount = await this.countUnreadMessages(
          m.room.id,
          user.id,
          m.lastReadAt
        );
        return this.mapRoomForClient(m.room, user.id, unreadCount);
      })
    );

    return mapped.sort((a, b) => {
      const ta = a.messages[0]?.createdAt
        ? new Date(a.messages[0].createdAt).getTime()
        : 0;
      const tb = b.messages[0]?.createdAt
        ? new Date(b.messages[0].createdAt).getTime()
        : 0;
      return tb - ta;
    });
  }

  async getRoom(user: User, roomId: string) {
    await this.assertRoomMember(user.id, roomId);
    return this.loadRoomForUser(user.id, roomId);
  }

  async markRoomRead(user: User, roomId: string) {
    await this.assertRoomMember(user.id, roomId);
    await this.prisma.chatRoomMember.update({
      where: {
        roomId_userId: { roomId, userId: user.id }
      },
      data: { lastReadAt: new Date() }
    });
    return { ok: true as const };
  }

  async listMessages(user: User, roomId: string, cursor?: string, take = 50) {
    await this.assertRoomMember(user.id, roomId);
    const lim = Math.min(Math.max(take, 1), 100);
    const include = {
      sender: { select: { id: true, fullName: true } }
    };
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
        include
      });
    }
    return this.prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: lim,
      include
    });
  }

  async createMessage(senderId: string, roomId: string, body: string) {
    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException("Message vide");
    }
    await this.assertRoomMember(senderId, roomId);
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { farmId: true }
    });
    const sanitized = await this.phoneSecurity.sanitizeMessageText(
      senderId,
      room?.farmId ?? null,
      trimmed
    );
    return this.prisma.chatMessage.create({
      data: {
        roomId,
        senderUserId: senderId,
        body: sanitized.body,
        wasModified: sanitized.wasModified,
        modificationType: sanitized.modificationType ?? undefined
      },
      include: {
        sender: { select: { id: true, fullName: true } }
      }
    });
  }

  async postFarmInvitationMessage(
    roomId: string,
    senderId: string,
    payload: FarmInvitationChatPayload
  ) {
    await this.assertRoomMember(senderId, roomId);
    const body = buildFarmInvitationMessageBody(payload);
    return this.prisma.chatMessage.create({
      data: {
        roomId,
        senderUserId: senderId,
        body
      },
      include: {
        sender: { select: { id: true, fullName: true } }
      }
    });
  }

  /** Met à jour le statut des cartes invitation JSON dans les salons. */
  async syncFarmInvitationMessageStatus(
    invitationId: string,
    status: "accepted" | "rejected"
  ): Promise<void> {
    const needle = `"invitationId":"${invitationId}"`;
    const messages = await this.prisma.chatMessage.findMany({
      where: { body: { contains: needle } },
      select: { id: true, body: true }
    });
    for (const msg of messages) {
      const parsed = parseFarmInvitationMessageBody(msg.body);
      if (!parsed || parsed.invitationId !== invitationId) {
        continue;
      }
      if (parsed.status === status) {
        continue;
      }
      const next: FarmInvitationChatPayload = { ...parsed, status };
      await this.prisma.chatMessage.update({
        where: { id: msg.id },
        data: { body: buildFarmInvitationMessageBody(next) }
      });
    }
  }

  async postMarketplaceOfferMessage(
    roomId: string,
    senderId: string,
    payload: MarketplaceOfferChatPayload
  ) {
    await this.assertRoomMember(senderId, roomId);
    const body = buildMarketplaceOfferMessageBody(payload);
    return this.prisma.chatMessage.create({
      data: {
        roomId,
        senderUserId: senderId,
        body
      },
      include: {
        sender: { select: { id: true, fullName: true } }
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
