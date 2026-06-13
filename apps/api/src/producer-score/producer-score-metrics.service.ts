import { Injectable } from "@nestjs/common";
import { OfferStatus, OfferType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const MS_PER_DAY = 86_400_000;
const HOURS_48 = 48;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function distinctDayCount(dates: Date[]): number {
  return new Set(dates.map(dayKey)).size;
}

@Injectable()
export class ProducerScoreMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnedFarmIds(userId: string): Promise<string[]> {
    const farms = await this.prisma.farm.findMany({
      where: { ownerId: userId, status: "active" },
      select: { id: true }
    });
    return farms.map((f) => f.id);
  }

  async collectDataEntryDays(userId: string, farmIds: string[], since: Date): Promise<number> {
    if (farmIds.length === 0) {
      return 0;
    }

    const [
      expenses,
      revenues,
      health,
      feed,
      tasks,
      animals,
      exits,
      weights
    ] = await Promise.all([
      this.prisma.farmExpense.findMany({
        where: { farmId: { in: farmIds }, occurredAt: { gte: since } },
        select: { occurredAt: true, createdAt: true }
      }),
      this.prisma.farmRevenue.findMany({
        where: { farmId: { in: farmIds }, occurredAt: { gte: since } },
        select: { occurredAt: true, createdAt: true }
      }),
      this.prisma.farmHealthRecord.findMany({
        where: { farmId: { in: farmIds }, occurredAt: { gte: since } },
        select: { occurredAt: true, createdAt: true }
      }),
      this.prisma.feedStockMovement.findMany({
        where: { farmId: { in: farmIds }, occurredAt: { gte: since } },
        select: { occurredAt: true, createdAt: true }
      }),
      this.prisma.farmTask.findMany({
        where: {
          farmId: { in: farmIds },
          OR: [{ createdAt: { gte: since } }, { completedAt: { gte: since } }]
        },
        select: { createdAt: true, completedAt: true }
      }),
      this.prisma.animal.findMany({
        where: { farmId: { in: farmIds }, createdAt: { gte: since } },
        select: { createdAt: true }
      }),
      this.prisma.livestockExit.findMany({
        where: { farmId: { in: farmIds }, occurredAt: { gte: since } },
        select: { occurredAt: true, createdAt: true }
      }),
      this.prisma.animalWeight.findMany({
        where: {
          animal: { farmId: { in: farmIds } },
          measuredAt: { gte: since }
        },
        select: { measuredAt: true }
      })
    ]);

    const dates: Date[] = [];
    for (const row of expenses) {
      dates.push(row.occurredAt, row.createdAt);
    }
    for (const row of revenues) {
      dates.push(row.occurredAt, row.createdAt);
    }
    for (const row of health) {
      dates.push(row.occurredAt, row.createdAt);
    }
    for (const row of feed) {
      dates.push(row.occurredAt, row.createdAt);
    }
    for (const row of tasks) {
      dates.push(row.createdAt);
      if (row.completedAt) dates.push(row.completedAt);
    }
    for (const row of animals) {
      dates.push(row.createdAt);
    }
    for (const row of exits) {
      dates.push(row.occurredAt, row.createdAt);
    }
    for (const row of weights) {
      dates.push(row.measuredAt);
    }

    return distinctDayCount(dates.filter((d) => d >= since));
  }

  async collectPlatformActiveDays(
    userId: string,
    farmIds: string[],
    since: Date,
    lastActiveAt: Date | null
  ): Promise<number> {
    const dates: Date[] = [];
    if (lastActiveAt && lastActiveAt >= since) {
      dates.push(lastActiveAt);
    }

    const memberships = await this.prisma.farmMembership.findMany({
      where: { userId, farmId: { in: farmIds.length ? farmIds : undefined } },
      select: { id: true }
    });
    const memberIds = memberships.map((m) => m.id);

    if (memberIds.length > 0) {
      const logs = await this.prisma.memberActivityLog.findMany({
        where: { memberId: { in: memberIds }, createdAt: { gte: since } },
        select: { createdAt: true }
      });
      for (const log of logs) {
        dates.push(log.createdAt);
      }
    }

    const userWrites = await this.collectUserAttributedDays(userId, farmIds, since);
    dates.push(...userWrites);

    return distinctDayCount(dates);
  }

  private async collectUserAttributedDays(
    userId: string,
    farmIds: string[],
    since: Date
  ): Promise<Date[]> {
    if (farmIds.length === 0) {
      return [];
    }
    const [expenses, revenues, health, feed, tasks] = await Promise.all([
      this.prisma.farmExpense.findMany({
        where: { farmId: { in: farmIds }, createdByUserId: userId, createdAt: { gte: since } },
        select: { createdAt: true }
      }),
      this.prisma.farmRevenue.findMany({
        where: { farmId: { in: farmIds }, createdByUserId: userId, createdAt: { gte: since } },
        select: { createdAt: true }
      }),
      this.prisma.farmHealthRecord.findMany({
        where: { farmId: { in: farmIds }, recordedByUserId: userId, createdAt: { gte: since } },
        select: { createdAt: true }
      }),
      this.prisma.feedStockMovement.findMany({
        where: { farmId: { in: farmIds }, createdByUserId: userId, createdAt: { gte: since } },
        select: { createdAt: true }
      }),
      this.prisma.farmTask.findMany({
        where: {
          farmId: { in: farmIds },
          OR: [
            { createdByUserId: userId, createdAt: { gte: since } },
            { completedByUserId: userId, completedAt: { gte: since } }
          ]
        },
        select: { createdAt: true, completedAt: true }
      })
    ]);

    const dates: Date[] = [];
    for (const row of [...expenses, ...revenues, ...health, ...feed]) {
      dates.push(row.createdAt);
    }
    for (const row of tasks) {
      dates.push(row.createdAt);
      if (row.completedAt) dates.push(row.completedAt);
    }
    return dates;
  }

  async collectOfferResponsiveness(userId: string, since: Date) {
    const offers = await this.prisma.marketplaceOffer.findMany({
      where: {
        listing: { sellerUserId: userId },
        createdAt: { gte: since }
      },
      select: { status: true, createdAt: true, updatedAt: true }
    });

    const received = offers.length;
    let respondedWithin48h = 0;

    for (const offer of offers) {
      if (offer.status === OfferStatus.pending) {
        continue;
      }
      const hours =
        (offer.updatedAt.getTime() - offer.createdAt.getTime()) / 3_600_000;
      if (hours <= HOURS_48) {
        respondedWithin48h += 1;
      }
    }

    return { offersReceived: received, offersRespondedWithin48h: respondedWithin48h };
  }

  async collectCreditBalancePunctuality(userId: string, since: Date) {
    const offers = await this.prisma.marketplaceOffer.findMany({
      where: {
        offerType: OfferType.credit,
        listing: { sellerUserId: userId },
        balanceConfirmedAt: { gte: since },
        status: OfferStatus.completed
      },
      select: { balanceConfirmedAt: true, balanceDueAt: true }
    });

    let onTime = 0;
    for (const offer of offers) {
      if (!offer.balanceConfirmedAt) continue;
      if (!offer.balanceDueAt || offer.balanceConfirmedAt <= offer.balanceDueAt) {
        onTime += 1;
      }
    }
    return { creditBalancesOnTime: onTime, creditBalancesTotal: offers.length };
  }

  isNewProducer(input: {
    userCreatedAt: Date;
    dataEntryDays: number;
    offersReceived: number;
    creditBalancesTotal: number;
  }): boolean {
    const accountAgeDays =
      (Date.now() - input.userCreatedAt.getTime()) / MS_PER_DAY;
    const totalSignals =
      input.dataEntryDays + input.offersReceived + input.creditBalancesTotal;
    return accountAgeDays < 30 && totalSignals < 5;
  }
}
