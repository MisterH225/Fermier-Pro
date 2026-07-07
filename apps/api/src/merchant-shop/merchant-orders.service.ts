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
  MerchantOrderStatus,
  MerchantProductStatus,
  Prisma
} from "@prisma/client";
import { ChatService } from "../chat/chat.service";
import { FeatureFlagService } from "../config-client/feature-flags.service";
import {
  MOBILE_MONEY_GATEWAY,
  type MobileMoneyGateway
} from "../marketplace/escrow/mobile-money.gateway";
import { PlatformSettingsService } from "../platform-settings/platform-settings.service";
import { PushNotificationsService } from "../push-notifications/push-notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { UserWalletService } from "../wallet/user-wallet.service";
import { MERCHANT_ERROR } from "./merchant-shop.constants";
import type {
  ConfirmMerchantPaymentDto,
  PurchaseMerchantProductDto
} from "./dto/merchant-shop.dto";

@Injectable()
export class MerchantOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly wallet: UserWalletService,
    private readonly featureFlags: FeatureFlagService,
    @Inject(MOBILE_MONEY_GATEWAY)
    private readonly gateway: MobileMoneyGateway,
    private readonly push: PushNotificationsService,
    private readonly chat: ChatService
  ) {}

  async listSellerOrders(user: User) {
    const rows = await this.prisma.merchantOrder.findMany({
      where: { sellerUserId: user.id },
      include: {
        product: { select: { id: true, name: true, photoUrls: true } },
        buyer: { select: { id: true, fullName: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((o) => this.serializeOrder(o));
  }

  async listBuyerOrders(user: User) {
    const rows = await this.prisma.merchantOrder.findMany({
      where: { buyerUserId: user.id },
      include: {
        product: { select: { id: true, name: true, photoUrls: true } },
        seller: { select: { id: true, fullName: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((o) => this.serializeOrder(o));
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
    paidAt: Date | null;
    createdAt: Date;
    product?: { id: string; name: string; photoUrls?: unknown };
    buyer?: { id: string; fullName: string | null };
    seller?: { id: string; fullName: string | null };
  }) {
    return {
      id: o.id,
      productId: o.productId,
      productName: o.product?.name ?? null,
      buyerUserId: o.buyerUserId,
      buyerName: o.buyer?.fullName ?? null,
      sellerUserId: o.sellerUserId,
      sellerName: o.seller?.fullName ?? null,
      quantity: o.quantity,
      unitPrice: Number(o.unitPrice),
      totalAmount: Number(o.totalAmount),
      buyerCommission: Number(o.buyerCommission),
      sellerCommission: Number(o.sellerCommission),
      paymentMethod: o.paymentMethod,
      providerRef: o.providerRef,
      status: o.status,
      paidAt: o.paidAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString()
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
      const init = await this.gateway.initiatePayment({
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
      const res = await this.gateway.confirmPayment(dto.providerRef, order.id);
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
    amounts: {
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

      await this.wallet.creditMerchantPayout(
        order.sellerUserId,
        amounts.sellerNet,
        order.product.currency,
        order.id,
        order.buyerUserId,
        `Vente boutique ${order.product.name}`
      );

      await tx.merchantOrder.update({
        where: { id: order.id },
        data: {
          status: MerchantOrderStatus.paid,
          paidAt: new Date()
        }
      });

      await tx.platformRevenue.create({
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
    });
  }

  private async afterPaid(
    buyer: User,
    order: { id: string; productId: string; sellerUserId: string; buyerUserId: string }
  ) {
    const fresh = await this.prisma.merchantOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: {
        product: { select: { id: true, name: true, photoUrls: true } },
        buyer: { select: { id: true, fullName: true } },
        seller: { select: { id: true, fullName: true } }
      }
    });

    void this.push.sendToUser(
      order.sellerUserId,
      "Nouvelle commande",
      `Commande reçue pour « ${fresh.product.name} »`,
      { type: "merchant_order_paid", orderId: order.id }
    );
    void this.push.sendToUser(
      order.buyerUserId,
      "Commande confirmée",
      `Paiement confirmé pour « ${fresh.product.name} »`,
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
