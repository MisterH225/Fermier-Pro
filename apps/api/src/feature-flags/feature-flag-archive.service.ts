import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { PlatformModuleId } from "./platform-modules.constants";

type ArchivePreview = {
  tableName: string;
  count: number;
};

@Injectable()
export class FeatureFlagArchiveService {
  constructor(private readonly prisma: PrismaService) {}

  async previewArchive(moduleId: PlatformModuleId): Promise<ArchivePreview[]> {
    switch (moduleId) {
      case "marketplace":
        return this.countMany([
          [
            "MarketplaceListing",
            () =>
              this.prisma.marketplaceListing.count({ where: { archived: false } })
          ],
          [
            "MarketplaceOffer",
            () =>
              this.prisma.marketplaceOffer.count({ where: { archived: false } })
          ]
        ]);
      case "buyer":
        return this.countMany([
          ["BuyerPriceAlert", () => this.safeBuyerPriceAlertCount()]
        ]);
      case "collaboration":
        return this.countMany([
          [
            "FarmInvitation",
            () =>
              this.prisma.farmInvitation.count({ where: { archived: false } })
          ],
          [
            "FarmMembership",
            () =>
              this.prisma.farmMembership.count({ where: { archived: false } })
          ]
        ]);
      case "technician":
        return this.countMany([
          [
            "FarmTask",
            () => this.prisma.farmTask.count({ where: { archived: false } })
          ]
        ]);
      case "gestation":
        return this.countMany([
          [
            "Gestation",
            () => this.prisma.gestation.count({ where: { archived: false } })
          ]
        ]);
      default:
        return [];
    }
  }

  async archiveModuleData(
    moduleId: PlatformModuleId
  ): Promise<Record<string, number>> {
    switch (moduleId) {
      case "marketplace":
        return {
          ...(await this.archiveListingRows()),
          ...(await this.archiveOfferRows())
        };
      case "buyer":
        return { ...(await this.archiveBuyerAlerts()) };
      case "collaboration":
        return {
          ...(await this.archiveInvitationRows()),
          ...(await this.archiveMembershipRows())
        };
      case "technician":
        return { ...(await this.archiveTaskRows()) };
      case "gestation":
        return { ...(await this.archiveGestationRows()) };
      default:
        return {};
    }
  }

  async restoreModuleData(
    moduleId: PlatformModuleId
  ): Promise<Record<string, number>> {
    const pending = await this.prisma.archivedDataRegistry.findMany({
      where: { moduleId, restoredAt: null }
    });
    const counts: Record<string, number> = {};
    const now = new Date();

    for (const row of pending) {
      const restored = await this.restoreRow(row.tableName, row.recordId);
      if (restored) {
        counts[row.tableName] = (counts[row.tableName] ?? 0) + 1;
        await this.prisma.archivedDataRegistry.update({
          where: { id: row.id },
          data: { restoredAt: now }
        });
      }
    }

    return counts;
  }

  private async countMany(
    entries: Array<[string, () => Promise<number>]>
  ): Promise<ArchivePreview[]> {
    const out: ArchivePreview[] = [];
    for (const [tableName, counter] of entries) {
      out.push({ tableName, count: await counter() });
    }
    return out;
  }

  private async safeBuyerPriceAlertCount(): Promise<number> {
    try {
      return await this.prisma.buyerPriceAlert.count({
        where: { archived: false, isActive: true }
      });
    } catch {
      return 0;
    }
  }

  private async archiveListingRows(): Promise<Record<string, number>> {
    const rows = await this.prisma.marketplaceListing.findMany({
      where: { archived: false },
      select: { id: true, status: true }
    });
    if (rows.length === 0) return {};
    await this.prisma.marketplaceListing.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { archived: true }
    });
    await this.registerMany("marketplace", "MarketplaceListing", rows);
    return { MarketplaceListing: rows.length };
  }

  private async archiveOfferRows(): Promise<Record<string, number>> {
    const rows = await this.prisma.marketplaceOffer.findMany({
      where: { archived: false },
      select: { id: true, status: true }
    });
    if (rows.length === 0) return {};
    await this.prisma.marketplaceOffer.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { archived: true }
    });
    await this.registerMany("marketplace", "MarketplaceOffer", rows);
    return { MarketplaceOffer: rows.length };
  }

  private async archiveBuyerAlerts(): Promise<Record<string, number>> {
    try {
      const rows = await this.prisma.buyerPriceAlert.findMany({
        where: { archived: false, isActive: true },
        select: { id: true }
      });
      if (rows.length === 0) return {};
      await this.prisma.buyerPriceAlert.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { archived: true, isActive: false }
      });
      await this.registerMany(
        "buyer",
        "BuyerPriceAlert",
        rows.map((r) => ({ id: r.id, status: "active" }))
      );
      return { BuyerPriceAlert: rows.length };
    } catch {
      return {};
    }
  }

  private async archiveInvitationRows(): Promise<Record<string, number>> {
    const rows = await this.prisma.farmInvitation.findMany({
      where: { archived: false },
      select: { id: true, status: true }
    });
    if (rows.length === 0) return {};
    await this.prisma.farmInvitation.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { archived: true }
    });
    await this.registerMany("collaboration", "FarmInvitation", rows);
    return { FarmInvitation: rows.length };
  }

  private async archiveMembershipRows(): Promise<Record<string, number>> {
    const rows = await this.prisma.farmMembership.findMany({
      where: { archived: false },
      select: { id: true, role: true }
    });
    if (rows.length === 0) return {};
    await this.prisma.farmMembership.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { archived: true }
    });
    await this.registerMany(
      "collaboration",
      "FarmMembership",
      rows.map((r) => ({ id: r.id, status: r.role }))
    );
    return { FarmMembership: rows.length };
  }

  private async archiveTaskRows(): Promise<Record<string, number>> {
    const rows = await this.prisma.farmTask.findMany({
      where: { archived: false },
      select: { id: true, status: true }
    });
    if (rows.length === 0) return {};
    await this.prisma.farmTask.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { archived: true }
    });
    await this.registerMany("technician", "FarmTask", rows);
    return { FarmTask: rows.length };
  }

  private async archiveGestationRows(): Promise<Record<string, number>> {
    const rows = await this.prisma.gestation.findMany({
      where: { archived: false },
      select: { id: true, status: true }
    });
    if (rows.length === 0) return {};
    await this.prisma.gestation.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { archived: true }
    });
    await this.registerMany("gestation", "Gestation", rows);
    return { Gestation: rows.length };
  }

  private async registerMany(
    moduleId: PlatformModuleId,
    tableName: string,
    rows: Array<{ id: string; status?: string; role?: string }>
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.prisma.archivedDataRegistry.createMany({
      data: rows.map((row) => ({
        moduleId,
        tableName,
        recordId: row.id,
        originalStatus: row.status ?? row.role ?? null
      }))
    });
  }

  private async restoreRow(
    tableName: string,
    recordId: string
  ): Promise<boolean> {
    switch (tableName) {
      case "MarketplaceListing":
        await this.prisma.marketplaceListing.update({
          where: { id: recordId },
          data: { archived: false }
        });
        return true;
      case "MarketplaceOffer":
        await this.prisma.marketplaceOffer.update({
          where: { id: recordId },
          data: { archived: false }
        });
        return true;
      case "FarmInvitation":
        await this.prisma.farmInvitation.update({
          where: { id: recordId },
          data: { archived: false }
        });
        return true;
      case "FarmMembership":
        await this.prisma.farmMembership.update({
          where: { id: recordId },
          data: { archived: false }
        });
        return true;
      case "FarmTask":
        await this.prisma.farmTask.update({
          where: { id: recordId },
          data: { archived: false }
        });
        return true;
      case "Gestation":
        await this.prisma.gestation.update({
          where: { id: recordId },
          data: { archived: false }
        });
        return true;
      case "BuyerPriceAlert":
        await this.prisma.buyerPriceAlert.update({
          where: { id: recordId },
          data: { archived: false, isActive: true }
        });
        return true;
      default:
        return false;
    }
  }
}
