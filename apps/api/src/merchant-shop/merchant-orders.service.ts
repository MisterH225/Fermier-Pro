import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  MarketplacePaymentMethod,
  MerchantOrderDisputeStatus,
  MerchantOrderStatus,
  MerchantProductStatus,
  Prisma
} from "@prisma/client";
import { ChatService } from "../chat/chat.service";
import { FeatureFlagService } from "../config-client/feature-flags.service";
import { GeniusPayMobileMoneyGateway } from "../marketplace/escrow/geniuspay/geniuspay-mobile-money.gateway";
import {
  MOBILE_MONEY_GATEWAY,
  type MobileMoneyGateway
} from "../marketplace/escrow/mobile-money.gateway";
import { PlatformSettingsService } from "../platform-settings/platform-settings.service";
import { UserNotificationsService } from "../user-notifications/user-notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { UserWalletService } from "../wallet/user-wallet.service";
import { MERCHANT_ERROR, MERCHANT_ORDER_CONFIRM_TIMEOUT_MS, MERCHANT_ORDER_DISPUTE_WINDOW_MS } from "./merchant-shop.constants";
import type {
  ConfirmMerchantPaymentDto,
  OpenMerchantOrderDisputeDto,
  PurchaseMerchantProductDto,
  RespondMerchantOrderDisputeDto
} from "./dto/merchant-shop.dto";

function usesGeniusPayProvider(): boolean {
  return (process.env.MOBILE_MONEY_PROVIDER ?? "dev").trim().toLowerCase() === "geniuspay";
}

@Injectable()
export class MerchantOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly wallet: UserWalletService,
    private readonly featureFlags: FeatureFlagService,
    @Inject(MOBILE_MONEY_GATEWAY)
    private readonly gateway: MobileMoneyGateway,
    private readonly geniusPay: GeniusPayMobileMoneyGateway,
    private readonly notifications: UserNotificationsService,
    private readonly chat: ChatService
  ) {}

  async listSellerOrders(user: User) {
    const rows = await this.prisma.merchantOrder.findMany({
      where: { sellerUserId: user.id },
      include: this.orderInclude(),
      orderBy: { createdAt: "desc" }
    });
    return rows.map((o) => this.serializeOrder(o));
  }

  async listBuyerOrders(user: User) {
    const rows = await this.prisma.merchantOrder.findMany({
      where: { buyerUserId: user.id },
      include: this.orderInclude(),
      orderBy: { createdAt: "desc" }
    });
    return rows.map((o) => this.serializeOrder(o));
  }

  async listAdminOrders(params?: { status?: string; take?: number }) {
    const take = Math.min(100, Math.max(1, params?.take ?? 50));
    const where: Prisma.MerchantOrderWhereInput = {};
    if (params?.status?.trim()) {
      where.status = params.status.trim() as MerchantOrderStatus;
    }
    const rows = await this.prisma.merchantOrder.findMany({
      where,
      include: this.orderInclude(),
      orderBy: { createdAt: "desc" },
      take
    });
    return rows.map((o) => this.serializeOrder(o));
  }

  async getOrder(user: User, orderId: string) {
    const order = await this.prisma.merchantOrder.findFirst({
      where: {
        id: orderId,
        OR: [{ sellerUserId: user.id }, { buyerUserId: user.id }]
      },
      include: this.orderInclude()
    });
    if (!order) {
      throw new NotFoundException("Commande introuvable");
    }
    return this.serializeOrder(order);
  }

  async completeOrder(user: User, orderId: string) {
    const order = await this.requireOrderForUser(orderId, user.id);
    // Legacy : vendeur marque terminée sans escrow
    if (
      !order.escrowHeld &&
      order.status === MerchantOrderStatus.paid &&
      order.sellerUserId === user.id
    ) {
      return this.transition(order, MerchantOrderStatus.completed, user.id, {
        completedAt: new Date()
      });
    }
    // Acheteur confirme réception
    if (order.buyerUserId !== user.id) {
      throw new ForbiddenException("Seul l'acheteur peut confirmer la réception");
    }
    if (order.status !== MerchantOrderStatus.delivered) {
      throw new BadRequestException({
        code: MERCHANT_ERROR.INVALID_TRANSITION,
        message: "Confirmez la réception uniquement après livraison"
      });
    }
    await this.releaseEscrow(order);
    return this.transition(order, MerchantOrderStatus.completed, user.id, {
      completedAt: new Date(),
      escrowHeld: false
    });
  }

  async confirmOrder(user: User, orderId: string) {
    const order = await this.requireSellerOrder(orderId, user.id);
    if (order.status !== MerchantOrderStatus.paid || !order.escrowHeld) {
      throw new BadRequestException({
        code: MERCHANT_ERROR.INVALID_TRANSITION,
        message: "Seules les commandes payées en attente peuvent être acceptées"
      });
    }
    const updated = await this.transition(
      order,
      MerchantOrderStatus.confirmed,
      user.id,
      { confirmedAt: new Date(), timeoutAt: null }
    );
    const productLabel = order.product?.name?.trim() || "votre commande";
    void this.notifications.notify(
      order.buyerUserId,
      "Commande confirmée",
      `Le commerçant a accepté ${productLabel}`,
      { type: "merchant_order_confirmed", orderId: order.id }
    );
    try {
      const room = await this.chat.ensureDirectRoom(
        user,
        order.buyerUserId,
        undefined,
        order.productId
      );
      await this.chat.createMessage(
        user.id,
        room.id,
        `Commande confirmée — je prépare ${productLabel}.`
      );
    } catch {
      // chat optionnel
    }
    return updated;
  }

  async rejectOrder(user: User, orderId: string) {
    const order = await this.requireSellerOrder(orderId, user.id);
    if (order.status !== MerchantOrderStatus.paid || !order.escrowHeld) {
      throw new BadRequestException({
        code: MERCHANT_ERROR.INVALID_TRANSITION,
        message: "Seules les commandes payées en attente peuvent être refusées"
      });
    }
    await this.refundEscrow(order);
    await this.restoreStock(order);
    const updated = await this.transition(
      order,
      MerchantOrderStatus.refunded,
      user.id,
      {
        rejectedAt: new Date(),
        resolvedAt: new Date(),
        timeoutAt: null,
        escrowHeld: false
      }
    );
    // Event audit: also log rejected as intermediate note
    await this.prisma.merchantOrderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: MerchantOrderStatus.paid,
        toStatus: MerchantOrderStatus.rejected,
        actorUserId: user.id,
        note: "Refus commerçant"
      }
    });
    void this.notifications.notify(
      order.buyerUserId,
      "Commande refusée",
      `Commande refusée — remboursement en cours`,
      { type: "merchant_order_rejected", orderId: order.id }
    );
    return updated;
  }

  async shipOrder(user: User, orderId: string) {
    const order = await this.requireSellerOrder(orderId, user.id);
    if (order.status !== MerchantOrderStatus.confirmed) {
      throw new BadRequestException({
        code: MERCHANT_ERROR.INVALID_TRANSITION,
        message: "Lancez la livraison après acceptation de la commande"
      });
    }
    const updated = await this.transition(
      order,
      MerchantOrderStatus.shipping,
      user.id,
      { shippedAt: new Date() }
    );
    void this.notifications.notify(
      order.buyerUserId,
      "Livraison en cours",
      `Votre commande est en livraison`,
      { type: "merchant_order_shipping", orderId: order.id }
    );
    return updated;
  }

  async markDelivered(user: User, orderId: string) {
    const order = await this.requireSellerOrder(orderId, user.id);
    if (order.status !== MerchantOrderStatus.shipping) {
      throw new BadRequestException({
        code: MERCHANT_ERROR.INVALID_TRANSITION,
        message: "Marquez livré uniquement pendant la livraison"
      });
    }
    const updated = await this.transition(
      order,
      MerchantOrderStatus.delivered,
      user.id,
      { deliveredAt: new Date() }
    );
    void this.notifications.notify(
      order.buyerUserId,
      "Commande livrée",
      `Confirmez la réception de votre commande`,
      { type: "merchant_order_delivered", orderId: order.id }
    );
    return updated;
  }

  async openDispute(user: User, orderId: string, dto: OpenMerchantOrderDisputeDto) {
    const order = await this.requireOrderForUser(orderId, user.id);
    if (order.dispute) {
      throw new ConflictException("Un litige existe déjà pour cette commande");
    }

    const now = Date.now();
    const canDisputeShipping = order.status === MerchantOrderStatus.shipping;
    const canDisputeDelivered =
      order.status === MerchantOrderStatus.delivered &&
      order.deliveredAt != null &&
      now - order.deliveredAt.getTime() <= MERCHANT_ORDER_DISPUTE_WINDOW_MS;
    // Legacy paid/completed without escrow timeline
    const canDisputeLegacy =
      !order.escrowHeld &&
      (order.status === MerchantOrderStatus.paid ||
        order.status === MerchantOrderStatus.completed);

    if (!canDisputeShipping && !canDisputeDelivered && !canDisputeLegacy) {
      throw new BadRequestException("Litige impossible sur cette commande");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.merchantOrderDispute.create({
        data: {
          orderId: order.id,
          openedByUserId: user.id,
          reason: dto.reason.trim()
        }
      });
      await tx.merchantOrderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: MerchantOrderStatus.disputed,
          actorUserId: user.id,
          note: dto.reason.trim().slice(0, 500)
        }
      });
      return tx.merchantOrder.update({
        where: { id: order.id },
        data: {
          status: MerchantOrderStatus.disputed,
          disputeOpenedAt: new Date()
        },
        include: this.orderInclude()
      });
    });

    const counterpartId =
      user.id === order.sellerUserId ? order.buyerUserId : order.sellerUserId;
    void this.notifications.notify(
      counterpartId,
      "Litige boutique",
      `Un litige a été ouvert pour la commande`,
      { type: "merchant_order_dispute", orderId: order.id }
    );

    return this.serializeOrder(updated);
  }

  async respondDispute(
    user: User,
    orderId: string,
    dto: RespondMerchantOrderDisputeDto
  ) {
    const order = await this.prisma.merchantOrder.findFirst({
      where: {
        id: orderId,
        OR: [{ sellerUserId: user.id }, { buyerUserId: user.id }]
      },
      include: { dispute: true }
    });
    if (!order?.dispute || order.dispute.status !== MerchantOrderDisputeStatus.open) {
      throw new NotFoundException("Litige introuvable ou déjà clos");
    }

    const isSeller = user.id === order.sellerUserId;
    const updated = await this.prisma.merchantOrderDispute.update({
      where: { id: order.dispute.id },
      data: isSeller
        ? { sellerNote: dto.note.trim() }
        : { buyerNote: dto.note.trim() },
      include: {
        order: { include: this.orderInclude() }
      }
    });
    return this.serializeOrder(updated.order);
  }

  async resolveDispute(
    adminUserId: string,
    orderId: string,
    decision: "buyer" | "seller",
    note?: string
  ) {
    const order = await this.prisma.merchantOrder.findFirst({
      where: { id: orderId },
      include: {
        dispute: true,
        product: { select: { id: true, name: true, currency: true, stock: true, status: true } }
      }
    });
    if (!order?.dispute || order.dispute.status !== MerchantOrderDisputeStatus.open) {
      throw new NotFoundException("Litige introuvable ou déjà clos");
    }
    if (order.status !== MerchantOrderStatus.disputed) {
      throw new BadRequestException("La commande n'est pas en litige");
    }

    const resolutionNote = note?.trim() || null;
    if (decision === "buyer") {
      if (order.escrowHeld) {
        await this.refundEscrow(order);
        await this.restoreStock(order);
      }
      await this.prisma.merchantOrderDispute.update({
        where: { id: order.dispute.id },
        data: {
          status: MerchantOrderDisputeStatus.resolved_buyer,
          resolvedAt: new Date(),
          resolvedByUserId: adminUserId,
          resolutionNote
        }
      });
      await this.transition(order, MerchantOrderStatus.refunded, adminUserId, {
        resolvedAt: new Date(),
        resolvedByUserId: adminUserId,
        resolutionNote,
        escrowHeld: false
      });
    } else {
      if (order.escrowHeld) {
        await this.releaseEscrow(order);
      }
      await this.prisma.merchantOrderDispute.update({
        where: { id: order.dispute.id },
        data: {
          status: MerchantOrderDisputeStatus.resolved_seller,
          resolvedAt: new Date(),
          resolvedByUserId: adminUserId,
          resolutionNote
        }
      });
      await this.transition(order, MerchantOrderStatus.completed, adminUserId, {
        completedAt: new Date(),
        resolvedAt: new Date(),
        resolvedByUserId: adminUserId,
        resolutionNote,
        escrowHeld: false
      });
    }

    void this.notifications.notify(
      order.buyerUserId,
      "Litige résolu",
      decision === "buyer"
        ? "Litige résolu — remboursement acheteur"
        : "Litige résolu — paiement commerçant validé",
      { type: "merchant_order_dispute_resolved", orderId: order.id }
    );
    void this.notifications.notify(
      order.sellerUserId,
      "Litige résolu",
      decision === "buyer"
        ? "Litige résolu — remboursement acheteur"
        : "Litige résolu — paiement commerçant validé",
      { type: "merchant_order_dispute_resolved", orderId: order.id }
    );

    return this.prisma.merchantOrder
      .findUniqueOrThrow({
        where: { id: orderId },
        include: this.orderInclude()
      })
      .then((o) => this.serializeOrder(o));
  }

  /** Cron : auto-rejet 24h + auto-complete 48h post-livraison. */
  async runTrackingCycle(now = new Date()) {
    const expired = await this.prisma.merchantOrder.findMany({
      where: {
        status: MerchantOrderStatus.paid,
        escrowHeld: true,
        timeoutAt: { lte: now }
      },
      include: {
        product: {
          select: { id: true, name: true, currency: true, stock: true, status: true }
        }
      },
      take: 100
    });

    for (const order of expired) {
      try {
        await this.refundEscrow(order);
        await this.restoreStock(order);
        await this.transition(order, MerchantOrderStatus.refunded, null, {
          rejectedAt: now,
          resolvedAt: now,
          timeoutAt: null,
          escrowHeld: false
        });
        await this.prisma.merchantOrderEvent.create({
          data: {
            orderId: order.id,
            fromStatus: MerchantOrderStatus.paid,
            toStatus: MerchantOrderStatus.auto_rejected,
            note: "Timeout 24h sans acceptation commerçant"
          }
        });
        void this.notifications.notify(
          order.buyerUserId,
          "Commande expirée",
          "Commande auto-annulée — délai commerçant dépassé",
          { type: "merchant_order_auto_rejected", orderId: order.id }
        );
        void this.notifications.notify(
          order.sellerUserId,
          "Commande expirée",
          "Commande non confirmée à temps — annulée",
          { type: "merchant_order_auto_rejected", orderId: order.id }
        );
      } catch (err) {
        // continue
      }
    }

    const disputeDeadline = new Date(
      now.getTime() - MERCHANT_ORDER_DISPUTE_WINDOW_MS
    );
    const toComplete = await this.prisma.merchantOrder.findMany({
      where: {
        status: MerchantOrderStatus.delivered,
        escrowHeld: true,
        deliveredAt: { lte: disputeDeadline }
      },
      include: {
        product: {
          select: { id: true, name: true, currency: true, stock: true, status: true }
        }
      },
      take: 100
    });

    for (const order of toComplete) {
      try {
        await this.releaseEscrow(order);
        await this.transition(order, MerchantOrderStatus.completed, null, {
          completedAt: now,
          escrowHeld: false
        });
        void this.notifications.notify(
          order.buyerUserId,
          "Commande clôturée",
          "Réception confirmée automatiquement — commande terminée",
          { type: "merchant_order_auto_completed", orderId: order.id }
        );
        void this.notifications.notify(
          order.sellerUserId,
          "Paiement libéré",
          "Escrow libéré — commande terminée",
          { type: "merchant_order_auto_completed", orderId: order.id }
        );
      } catch {
        // continue
      }
    }
  }

  private async requireOrderForUser(orderId: string, userId: string) {
    const order = await this.prisma.merchantOrder.findFirst({
      where: {
        id: orderId,
        OR: [{ sellerUserId: userId }, { buyerUserId: userId }]
      },
      include: {
        dispute: true,
        product: {
          select: { id: true, name: true, currency: true, stock: true, status: true }
        }
      }
    });
    if (!order) {
      throw new NotFoundException("Commande introuvable");
    }
    return order;
  }

  private async requireSellerOrder(orderId: string, sellerUserId: string) {
    const order = await this.prisma.merchantOrder.findFirst({
      where: { id: orderId, sellerUserId },
      include: {
        dispute: true,
        product: {
          select: { id: true, name: true, currency: true, stock: true, status: true }
        }
      }
    });
    if (!order) {
      throw new NotFoundException("Commande introuvable");
    }
    return order;
  }

  private async transition(
    order: { id: string; status: MerchantOrderStatus },
    toStatus: MerchantOrderStatus,
    actorUserId: string | null,
    data: Prisma.MerchantOrderUpdateInput = {}
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.merchantOrderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus,
          actorUserId
        }
      });
      return tx.merchantOrder.update({
        where: { id: order.id },
        data: { status: toStatus, ...data },
        include: this.orderInclude()
      });
    });
    return this.serializeOrder(updated);
  }

  private async releaseEscrow(order: {
    id: string;
    sellerUserId: string;
    buyerUserId: string;
    totalAmount: Prisma.Decimal;
    sellerCommission: Prisma.Decimal;
    buyerCommission: Prisma.Decimal;
    escrowHeld: boolean;
    product: { name: string; currency: string };
  }) {
    if (!order.escrowHeld) {
      return;
    }
    const amounts = await this.computeAmounts(Number(order.totalAmount));
    await this.wallet.creditMerchantPayout(
      order.sellerUserId,
      amounts.sellerNet,
      order.product.currency,
      order.id,
      order.buyerUserId,
      `Vente boutique ${order.product.name}`
    );
    const existingRev = await this.prisma.platformRevenue.findFirst({
      where: { merchantOrderId: order.id }
    });
    if (!existingRev) {
      await this.prisma.platformRevenue.create({
        data: {
          merchantOrderId: order.id,
          sellerId: order.sellerUserId,
          buyerId: order.buyerUserId,
          grossAmount: order.totalAmount,
          commissionRate: new Prisma.Decimal(amounts.buyerRate),
          commissionAmount: new Prisma.Decimal(amounts.platformFee),
          type: "COMMISSION"
        }
      });
    }
  }

  private async refundEscrow(order: {
    id: string;
    buyerUserId: string;
    totalAmount: Prisma.Decimal;
    buyerCommission: Prisma.Decimal;
    escrowHeld: boolean;
    product: { currency: string; name: string };
  }) {
    if (!order.escrowHeld) {
      return;
    }
    const amounts = await this.computeAmounts(Number(order.totalAmount));
    await this.wallet.creditMerchantOrderRefund(
      order.buyerUserId,
      amounts.blockedAmount,
      order.product.currency,
      order.id,
      `Remboursement commande boutique ${order.product.name}`
    );
  }

  private async restoreStock(order: {
    productId: string;
    quantity: number;
  }) {
    await this.prisma.merchantProduct.update({
      where: { id: order.productId },
      data: {
        stock: { increment: order.quantity },
        status: MerchantProductStatus.published
      }
    });
  }

  private orderInclude() {
    return {
      product: { select: { id: true, name: true, photoUrls: true, currency: true } },
      buyer: { select: { id: true, fullName: true, phone: true } },
      seller: { select: { id: true, fullName: true, phone: true } },
      dispute: true,
      events: { orderBy: { createdAt: "asc" as const }, take: 50 }
    } as const;
  }

  private serializeOrder(o: {
    id: string;
    productId: string;
    buyerUserId: string;
    sellerUserId: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    buyerCommission: Prisma.Decimal;
    sellerCommission: Prisma.Decimal;
    paymentMethod: MarketplacePaymentMethod;
    providerRef: string | null;
    status: MerchantOrderStatus;
    escrowHeld?: boolean;
    paidAt: Date | null;
    confirmedAt?: Date | null;
    shippedAt?: Date | null;
    deliveredAt?: Date | null;
    completedAt?: Date | null;
    rejectedAt?: Date | null;
    disputeOpenedAt?: Date | null;
    resolvedAt?: Date | null;
    resolutionNote?: string | null;
    timeoutAt?: Date | null;
    createdAt: Date;
    product?: {
      id: string;
      name: string;
      photoUrls?: unknown;
      currency?: string;
    };
    buyer?: { id: string; fullName: string | null; phone?: string | null };
    seller?: { id: string; fullName: string | null; phone?: string | null };
    dispute?: {
      id: string;
      reason: string;
      sellerNote: string | null;
      buyerNote: string | null;
      status: MerchantOrderDisputeStatus;
      openedByUserId: string;
      createdAt: Date;
      resolvedAt: Date | null;
      resolutionNote?: string | null;
    } | null;
    events?: Array<{
      id: string;
      fromStatus: MerchantOrderStatus | null;
      toStatus: MerchantOrderStatus;
      actorUserId: string | null;
      note: string | null;
      createdAt: Date;
    }>;
  }) {
    const photos = Array.isArray(o.product?.photoUrls)
      ? o.product.photoUrls.filter((u): u is string => typeof u === "string")
      : [];
    const sellerNet =
      Number(o.totalAmount) - Number(o.sellerCommission);
    const disputeWindowEndsAt =
      o.deliveredAt != null
        ? new Date(
            o.deliveredAt.getTime() + MERCHANT_ORDER_DISPUTE_WINDOW_MS
          ).toISOString()
        : null;
    return {
      id: o.id,
      productId: o.productId,
      productName: o.product?.name ?? null,
      productPhotoUrls: photos,
      productCurrency: o.product?.currency ?? "XOF",
      buyerUserId: o.buyerUserId,
      buyerName: o.buyer?.fullName ?? null,
      buyerPhone: o.buyer?.phone ?? null,
      sellerUserId: o.sellerUserId,
      sellerName: o.seller?.fullName ?? null,
      sellerPhone: o.seller?.phone ?? null,
      quantity: o.quantity,
      unitPrice: Number(o.unitPrice),
      totalAmount: Number(o.totalAmount),
      buyerCommission: Number(o.buyerCommission),
      sellerCommission: Number(o.sellerCommission),
      sellerNet,
      paymentMethod: o.paymentMethod,
      providerRef: o.providerRef,
      status: o.status,
      escrowHeld: o.escrowHeld ?? true,
      paidAt: o.paidAt?.toISOString() ?? null,
      confirmedAt: o.confirmedAt?.toISOString() ?? null,
      shippedAt: o.shippedAt?.toISOString() ?? null,
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
      completedAt: o.completedAt?.toISOString() ?? null,
      rejectedAt: o.rejectedAt?.toISOString() ?? null,
      disputeOpenedAt: o.disputeOpenedAt?.toISOString() ?? null,
      resolvedAt: o.resolvedAt?.toISOString() ?? null,
      resolutionNote: o.resolutionNote ?? null,
      timeoutAt: o.timeoutAt?.toISOString() ?? null,
      disputeWindowEndsAt,
      createdAt: o.createdAt.toISOString(),
      timeline: (o.events ?? []).map((e) => ({
        id: e.id,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        actorUserId: e.actorUserId,
        note: e.note,
        createdAt: e.createdAt.toISOString()
      })),
      dispute: o.dispute
        ? {
            id: o.dispute.id,
            reason: o.dispute.reason,
            sellerNote: o.dispute.sellerNote,
            buyerNote: o.dispute.buyerNote,
            status: o.dispute.status,
            openedByUserId: o.dispute.openedByUserId,
            createdAt: o.dispute.createdAt.toISOString(),
            resolvedAt: o.dispute.resolvedAt?.toISOString() ?? null,
            resolutionNote: o.dispute.resolutionNote ?? null
          }
        : null
    };
  }

  private async computeAmounts(totalDeal: number) {
    const buyerRate = await this.platformSettings.getMarketplaceCommissionRate();
    const sellerRate =
      await this.platformSettings.getSellerMarketplaceCommissionRate();
    const buyerCommission = Math.round(totalDeal * buyerRate);
    const sellerCommission = Math.round(totalDeal * sellerRate);
    const blockedAmount = totalDeal + buyerCommission;
    const sellerNet = totalDeal - sellerCommission;
    const platformFee = buyerCommission + sellerCommission;
    return {
      buyerRate,
      sellerRate,
      buyerCommission,
      sellerCommission,
      blockedAmount,
      sellerNet,
      platformFee
    };
  }

  async initiatePurchase(
    buyer: User,
    productId: string,
    dto: PurchaseMerchantProductDto
  ) {
    const product = await this.prisma.merchantProduct.findFirst({
      where: {
        id: productId,
        status: MerchantProductStatus.published
      },
      include: {
        shop: {
          select: {
            merchantProfile: { select: { userId: true } }
          }
        }
      }
    });
    if (!product) {
      throw new NotFoundException("Produit introuvable");
    }
    if (product.shop.merchantProfile.userId === buyer.id) {
      throw new ForbiddenException("Vous ne pouvez pas acheter votre propre produit");
    }
    if (product.stock < dto.quantity) {
      throw new ConflictException({
        statusCode: 409,
        code: MERCHANT_ERROR.STOCK_UNAVAILABLE,
        message: "Stock insuffisant"
      });
    }

    const unitPrice = Number(product.price);
    const totalDeal = Math.round(unitPrice * dto.quantity);
    const amounts = await this.computeAmounts(totalDeal);

    const order = await this.prisma.merchantOrder.create({
      data: {
        productId: product.id,
        buyerUserId: buyer.id,
        sellerUserId: product.shop.merchantProfile.userId,
        quantity: dto.quantity,
        unitPrice: new Prisma.Decimal(unitPrice),
        totalAmount: new Prisma.Decimal(totalDeal),
        buyerCommission: new Prisma.Decimal(amounts.buyerCommission),
        sellerCommission: new Prisma.Decimal(amounts.sellerCommission),
        paymentMethod: dto.paymentMethod,
        status: MerchantOrderStatus.payment_pending
      }
    });

    let hold: {
      providerRef: string;
      paymentMethod: MarketplacePaymentMethod;
      paymentUrl?: string | null;
    };

    if (dto.paymentMethod === MarketplacePaymentMethod.wallet) {
      const walletEnabled = await this.featureFlags.isEnabled("wallet");
      if (!walletEnabled) {
        const { moduleId, message } =
          await this.featureFlags.resolveInactiveContext("wallet");
        throw new ServiceUnavailableException({
          statusCode: 503,
          code: "MODULE_INACTIVE",
          moduleId,
          feature: "wallet",
          message: message ?? "Portefeuille désactivé",
          error: "Service Unavailable"
        });
      }
      await this.wallet.assertSufficientBalance(buyer.id, amounts.blockedAmount);
      hold = {
        providerRef: this.wallet.merchantPendingRef(order.id),
        paymentMethod: MarketplacePaymentMethod.wallet,
        paymentUrl: null
      };
    } else {
      const init = usesGeniusPayProvider()
        ? await this.geniusPay.initiateMerchantOrderPayment({
            amount: amounts.blockedAmount,
            currency: product.currency,
            buyerUserId: buyer.id,
            orderId: order.id,
            label: `Boutique ${product.name}`
          })
        : await this.gateway.initiatePayment({
            amount: amounts.blockedAmount,
            currency: product.currency,
            buyerUserId: buyer.id,
            transactionId: order.id,
            label: `Boutique ${product.name}`
          });
      hold = {
        providerRef: init.providerRef,
        paymentMethod: MarketplacePaymentMethod.mobile_money,
        paymentUrl: init.paymentUrl ?? null
      };
    }

    if (
      dto.paymentMethod === MarketplacePaymentMethod.mobile_money &&
      !hold.paymentUrl?.trim() &&
      (process.env.MOBILE_MONEY_PROVIDER ?? "dev").trim().toLowerCase() !== "dev"
    ) {
      throw new BadGatewayException(
        "GeniusPay n'a pas renvoyé d'URL de checkout pour ce paiement"
      );
    }

    await this.prisma.merchantOrder.update({
      where: { id: order.id },
      data: { providerRef: hold.providerRef }
    });

    return {
      orderId: order.id,
      providerRef: hold.providerRef,
      amount: amounts.blockedAmount,
      currency: product.currency,
      paymentMethod: hold.paymentMethod,
      paymentUrl: hold.paymentUrl ?? null
    };
  }

  async confirmPayment(
    buyer: User,
    orderId: string,
    dto: ConfirmMerchantPaymentDto
  ) {
    const order = await this.prisma.merchantOrder.findFirst({
      where: { id: orderId, buyerUserId: buyer.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            photoUrls: true,
            currency: true,
            stock: true,
            status: true
          }
        }
      }
    });
    if (!order) {
      throw new NotFoundException("Commande introuvable");
    }
    if (order.status === MerchantOrderStatus.paid) {
      return this.serializeOrder(order);
    }
    if (order.status !== MerchantOrderStatus.payment_pending) {
      throw new BadRequestException("Statut de commande invalide");
    }
    if (!order.providerRef || order.providerRef !== dto.providerRef) {
      throw new BadRequestException("Référence paiement invalide");
    }

    const amounts = await this.computeAmounts(Number(order.totalAmount));
    const blockedAmount = amounts.blockedAmount;
    const label = `Boutique ${order.product.name}`;

    if (
      order.paymentMethod === MarketplacePaymentMethod.wallet ||
      this.wallet.isMerchantWalletPendingRef(dto.providerRef)
    ) {
      await this.wallet.confirmMerchantPendingHold(
        dto.providerRef,
        buyer.id,
        blockedAmount,
        order.product.currency,
        order.id,
        label
      );
    } else {
      const res = usesGeniusPayProvider()
        ? await this.geniusPay.confirmMerchantOrderPayment(
            dto.providerRef,
            order.id
          )
        : await this.gateway.confirmPayment(dto.providerRef, order.id);
      if (!res.success) {
        await this.prisma.merchantOrder.update({
          where: { id: order.id },
          data: { status: MerchantOrderStatus.failed }
        });
        throw new BadRequestException(
          res.failureReason ?? "Paiement non confirmé"
        );
      }
    }

    await this.settleOrderAtomic(order, amounts);
    return this.afterPaid(buyer, order);
  }

  /** Confirmation asynchrone via webhook GeniusPay (sans JWT acheteur). */
  async confirmPaymentFromWebhook(
    orderId: string,
    providerRef: string,
    webhookAmount?: number,
    webhookCurrency?: string
  ) {
    const order = await this.prisma.merchantOrder.findFirst({
      where: { id: orderId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            photoUrls: true,
            currency: true,
            stock: true,
            status: true
          }
        },
        buyer: true
      }
    });
    if (!order) {
      throw new BadRequestException("Commande introuvable");
    }
    if (order.status === MerchantOrderStatus.paid) {
      return { ok: true, idempotent: true };
    }
    if (order.status !== MerchantOrderStatus.payment_pending) {
      throw new BadRequestException("Statut invalide pour confirmation webhook");
    }
    if (order.providerRef && order.providerRef !== providerRef) {
      // GeniusPay peut renvoyer une référence normalisée au succès.
      await this.prisma.merchantOrder.update({
        where: { id: order.id },
        data: { providerRef }
      });
    } else if (!order.providerRef) {
      await this.prisma.merchantOrder.update({
        where: { id: order.id },
        data: { providerRef }
      });
    }
    const amounts = await this.computeAmounts(Number(order.totalAmount));
    if (webhookAmount !== undefined) {
      if (Math.abs(webhookAmount - amounts.blockedAmount) > 1) {
        throw new BadRequestException("Montant webhook incohérent");
      }
    }
    if (webhookCurrency && webhookCurrency !== order.product.currency) {
      throw new BadRequestException("Devise webhook incohérente");
    }

    await this.settleOrderAtomic(order, amounts);
    await this.afterPaid(order.buyer, order);
    return { ok: true };
  }

  async failPaymentFromWebhook(orderId: string, providerRef: string) {
    await this.prisma.merchantOrder.updateMany({
      where: {
        id: orderId,
        status: MerchantOrderStatus.payment_pending,
        providerRef
      },
      data: { status: MerchantOrderStatus.failed }
    });
    return { ok: true };
  }

  private async settleOrderAtomic(
    order: {
      id: string;
      productId: string;
      sellerUserId: string;
      buyerUserId: string;
      quantity: number;
      totalAmount: Prisma.Decimal;
      product: {
        id: string;
        name: string;
        currency: string;
        stock: number;
        status: MerchantProductStatus;
      };
    },
    _amounts: {
      buyerRate: number;
      sellerNet: number;
      platformFee: number;
    }
  ) {
    await this.prisma.$transaction(async (tx) => {
      const stockUpdate = await tx.merchantProduct.updateMany({
        where: {
          id: order.productId,
          status: MerchantProductStatus.published,
          stock: { gte: order.quantity }
        },
        data: { stock: { decrement: order.quantity } }
      });
      if (stockUpdate.count !== 1) {
        throw new ConflictException({
          statusCode: 409,
          code: MERCHANT_ERROR.STOCK_UNAVAILABLE,
          message: "Stock insuffisant"
        });
      }

      const remaining = order.product.stock - order.quantity;
      if (remaining <= 0) {
        await tx.merchantProduct.update({
          where: { id: order.productId },
          data: { status: MerchantProductStatus.disabled }
        });
      }

      // Escrow différé : pas de payout vendeur ici
      const paidAt = new Date();
      await tx.merchantOrder.update({
        where: { id: order.id },
        data: {
          status: MerchantOrderStatus.paid,
          paidAt,
          escrowHeld: true,
          timeoutAt: new Date(
            paidAt.getTime() + MERCHANT_ORDER_CONFIRM_TIMEOUT_MS
          )
        }
      });

      await tx.merchantOrderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: MerchantOrderStatus.payment_pending,
          toStatus: MerchantOrderStatus.paid,
          note: "Paiement confirmé — escrow bloqué"
        }
      });
    });
  }

  private async afterPaid(
    buyer: User,
    order: { id: string; productId: string; sellerUserId: string; buyerUserId: string }
  ) {
    const fresh = await this.prisma.merchantOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: this.orderInclude()
    });

    void this.notifications.notify(
      order.sellerUserId,
      "Nouvelle commande",
      `Nouvelle commande — confirmez sous 24h`,
      { type: "merchant_order_paid", orderId: order.id }
    );
    void this.notifications.notify(
      order.buyerUserId,
      "Paiement confirmé",
      `Paiement reçu — en attente de confirmation du commerçant`,
      { type: "merchant_order_paid", orderId: order.id }
    );

    try {
      await this.chat.ensureDirectRoom(
        buyer,
        order.sellerUserId,
        undefined,
        order.productId
      );
    } catch {
      // chat optionnel
    }

    return this.serializeOrder(fresh);
  }
}
