import { Injectable } from "@nestjs/common";
import type { MemberActivityModule, User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";

export type LogMemberActivityParams = {
  farmId: string;
  memberId: string;
  module: MemberActivityModule;
  action: string;
  detail?: Record<string, unknown>;
};

@Injectable()
export class MemberActivityLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService
  ) {}

  async log(params: LogMemberActivityParams): Promise<void> {
    await this.prisma.memberActivityLog.create({
      data: {
        farmId: params.farmId,
        memberId: params.memberId,
        module: params.module,
        action: params.action,
        detail: params.detail
          ? (params.detail as Prisma.InputJsonValue)
          : Prisma.JsonNull
      }
    });
  }

  async listForFarm(
    actor: User,
    farmId: string,
    opts?: {
      memberId?: string;
      module?: MemberActivityModule;
      cursor?: string;
      limit?: number;
    }
  ) {
    await this.farmAccess.requireFarmAccess(actor.id, farmId);
    const take = Math.min(opts?.limit ?? 30, 100);
    const rows = await this.prisma.memberActivityLog.findMany({
      where: {
        farmId,
        ...(opts?.memberId ? { memberId: opts.memberId } : {}),
        ...(opts?.module ? { module: opts.module } : {}),
        ...(opts?.cursor ? { id: { lt: opts.cursor } } : {})
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        member: {
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    const nextCursor =
      rows.length === take ? rows[rows.length - 1]?.id : undefined;
    return { items: rows, nextCursor };
  }
}
