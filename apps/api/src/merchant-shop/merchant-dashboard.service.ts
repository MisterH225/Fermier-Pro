import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  MerchantOrderStatus,
  MerchantProductStatus,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MerchantProfilesService } from "./merchant-profiles.service";

const LOW_STOCK_THRESHOLD = 5;

@Injectable()
export class MerchantDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: MerchantProfilesService
  ) {}

  async getDashboard(user: User) {
    const profile = await this.profiles.requireProfile(user.id);
    const shopIds = profile.shops.map((s) => s.id);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      monthOrders,
      pendingOrders,
      productViews,
      lowStockProducts,
      moderationEvents
    ] = await Promise.all([
      this.prisma.merchantOrder.findMany({
        where: {
          sellerUserId: user.id,
          status: { in: [MerchantOrderStatus.paid, MerchantOrderStatus.completed] },
          paidAt: { gte: monthStart }
        },
        select: {
          totalAmount: true,
          sellerCommission: true
        }
      }),
      this.prisma.merchantOrder.count({
        where: {
          sellerUserId: user.id,
          status: MerchantOrderStatus.paid,
          escrowHeld: true
        }
      }),
      shopIds.length
        ? this.prisma.merchantProduct.aggregate({
            where: { shopId: { in: shopIds } },
            _sum: { viewCount: true }
          })
        : Promise.resolve({ _sum: { viewCount: 0 } }),
      shopIds.length
        ? this.prisma.merchantProduct.findMany({
            where: {
              shopId: { in: shopIds },
              status: MerchantProductStatus.published,
              stock: { lte: LOW_STOCK_THRESHOLD, gt: 0 }
            },
            select: {
              id: true,
              name: true,
              stock: true,
              shop: { select: { name: true } }
            },
            orderBy: { stock: "asc" },
            take: 10
          })
        : Promise.resolve([]),
      shopIds.length
        ? this.prisma.merchantProductModerationLog.findMany({
            where: {
              product: { shopId: { in: shopIds } }
            },
            include: {
              product: { select: { id: true, name: true } }
            },
            orderBy: { deletedAt: "desc" },
            take: 5
          })
        : Promise.resolve([])
    ]);

    const monthRevenueXof = monthOrders.reduce(
      (sum, o) =>
        sum + Number(o.totalAmount) - Number(o.sellerCommission),
      0
    );

    return {
      kpis: {
        monthRevenueXof,
        pendingOrders,
        productViews: productViews._sum?.viewCount ?? 0
      },
      lowStockProducts: lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        shopName: p.shop.name
      })),
      moderationEvents: moderationEvents.map((e) => ({
        id: e.id,
        productId: e.productId,
        productName: e.product.name,
        reason: e.reason,
        deletedAt: e.deletedAt.toISOString()
      }))
    };
  }
}
