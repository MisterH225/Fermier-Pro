import { Injectable, NotFoundException } from "@nestjs/common";
import { ChatRoomKind } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ChatAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listRooms(
    page = 1,
    limit = 20,
    kind?: ChatRoomKind,
    userId?: string
  ) {
    const skip = (page - 1) * limit;
    const where = {
      ...(kind ? { kind } : {}),
      ...(userId ? { members: { some: { userId } } } : {})
    };

    const [total, rooms] = await Promise.all([
      this.prisma.chatRoom.count({ where }),
      this.prisma.chatRoom.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: {
          farm: { select: { id: true, name: true } },
          marketplaceListing: { select: { id: true, title: true } },
          members: {
            include: {
              user: { select: { id: true, email: true, fullName: true } }
            }
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              sender: { select: { id: true, fullName: true } }
            }
          },
          _count: { select: { messages: true, members: true } }
        }
      })
    ]);

    return {
      page,
      limit,
      total,
      items: rooms.map((room) => ({
        id: room.id,
        kind: room.kind,
        title: room.title,
        farmId: room.farmId,
        farmName: room.farm?.name ?? null,
        directKey: room.directKey,
        marketplaceListingId: room.marketplaceListingId,
        marketplaceListingTitle: room.marketplaceListing?.title ?? null,
        memberCount: room._count.members,
        messageCount: room._count.messages,
        members: room.members.map((m) => ({
          userId: m.userId,
          email: m.user.email,
          fullName: m.user.fullName
        })),
        lastMessage: room.messages[0]
          ? {
              id: room.messages[0].id,
              body: room.messages[0].body.slice(0, 500),
              createdAt: room.messages[0].createdAt.toISOString(),
              senderName: room.messages[0].sender.fullName
            }
          : null,
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString()
      }))
    };
  }

  async listRoomMessages(roomId: string, limit = 50) {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException("Salon introuvable.");
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
      include: {
        sender: { select: { id: true, email: true, fullName: true } }
      }
    });

    return messages
      .reverse()
      .map((m) => ({
        id: m.id,
        body: m.body,
        wasModified: m.wasModified,
        modificationType: m.modificationType,
        createdAt: m.createdAt.toISOString(),
        senderUserId: m.senderUserId,
        senderEmail: m.sender.email,
        senderName: m.sender.fullName
      }));
  }

  async deleteRoom(roomId: string, reason?: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        members: { select: { userId: true } }
      }
    });
    if (!room) {
      throw new NotFoundException("Salon introuvable.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.chatMessage.deleteMany({ where: { roomId } });
      await tx.chatRoomMember.deleteMany({ where: { roomId } });
      await tx.chatRoom.delete({ where: { id: roomId } });
    });

    return {
      ok: true,
      deletedRoomId: roomId,
      reason: reason?.trim() || "admin_removal",
      memberUserIds: room.members.map((m) => m.userId)
    };
  }
}
