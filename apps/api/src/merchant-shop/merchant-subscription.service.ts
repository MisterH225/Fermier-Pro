import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  MarketplacePaymentMethod,
  MerchantProductDisabledReason,
  MerchantProductStatus,
  MerchantSubscriptionInvoiceStatus,
  MerchantSubscriptionTier
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UserWalletService } from "../wallet/user-wallet.service";
import type { ChooseMerchantSubscriptionDto } from "./dto/merchant-shop.dto";
import { MerchantProfilesService } from "./merchant-profiles.service";
import { MerchantSubscriptionBillingService } from "./merchant-subscription-billing.service";
import { MERCHANT_FREE_MAX_ACTIVE_PRODUCTS } from "./merchant-shop.constants";
import { addMonthsUtc, startOfUtcDay } from "./merchant-subscription.constants";

@Injectable()
export class MerchantSubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: MerchantProfilesService,
    private readonly wallet: UserWalletService,
    private readonly billing: MerchantSubscriptionBillingService
  ) {}

  private premiumRef(userId: string): string {
    return `merchant-premium:${userId}`;
  }

  async choose(user: User, dto: ChooseMerchantSubscriptionDto) {
    const profile = await this.profiles.ensureProfile(user.id);

    if (dto.tier === MerchantSubscriptionTier.free) {
      if (profile.subscriptionTier) {
        return this.profiles.getMe(user);
      }
      await this.prisma.merchantProfile.update({
        where: { userId: user.id },
        data: {
          subscriptionTier: MerchantSubscriptionTier.free,
          subscriptionChosenAt: new Date()
        }
      });
      return this.profiles.getMe(user);
    }

    if (profile.subscriptionTier === MerchantSubscriptionTier.premium) {
      return this.profiles.getMe(user);
    }

    const price = await this.billing.getPremiumPriceXof();
    const method =
      dto.paymentMethod ?? MarketplacePaymentMethod.mobile_money;

    if (method === MarketplacePaymentMethod.wallet) {
      await this.wallet.assertSufficientBalance(user.id, price);
      await this.wallet.debitForMerchantSubscription(
        user.id,
        price,
        "XOF",
        this.premiumRef(user.id),
        "Abonnement Premium commerçant"
      );
      const paidAt = new Date();
      const periodStart = startOfUtcDay(paidAt);
      await this.prisma.merchantSubscriptionInvoice.create({
        data: {
          merchantProfileId: profile.id,
          amount: price,
          currency: "XOF",
          status: MerchantSubscriptionInvoiceStatus.paid,
          billingPeriodStart: periodStart,
          billingPeriodEnd: addMonthsUtc(periodStart, 1),
          dueDate: periodStart,
          paidAt,
          providerRef: this.premiumRef(user.id)
        }
      });
      await this.prisma.merchantProfile.update({
        where: { userId: user.id },
        data: {
          subscriptionChosenAt: profile.subscriptionChosenAt ?? new Date()
        }
      });
      await this.billing.activatePremium(profile.id, paidAt);
      return this.profiles.getMe(user);
    }

    const periodStart = startOfUtcDay(new Date());
    const invoice = await this.billing.createPendingInvoice(
      profile.id,
      user.id,
      periodStart,
      price
    );
    return {
      pending: true,
      tier: MerchantSubscriptionTier.premium,
      amount: price,
      paymentMethod: method,
      providerRef: invoice.providerRef,
      paymentUrl: invoice.paymentUrl ?? null,
      invoiceId: invoice.id
    };
  }

  async confirmPremiumPayment(user: User, providerRef: string) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId: user.id }
    });
    if (!profile) {
      throw new NotFoundException("Profil commerçant introuvable");
    }

    const invoice = await this.prisma.merchantSubscriptionInvoice.findFirst({
      where: {
        merchantProfileId: profile.id,
        providerRef,
        status: MerchantSubscriptionInvoiceStatus.pending
      }
    });

    if (invoice) {
      await this.billing.confirmInvoicePayment(providerRef, invoice.id);
      if (!profile.subscriptionChosenAt) {
        await this.prisma.merchantProfile.update({
          where: { userId: user.id },
          data: { subscriptionChosenAt: new Date() }
        });
      }
      return this.profiles.getMe(user);
    }

    if (this.wallet.isWalletPendingRef(providerRef)) {
      const price = await this.billing.getPremiumPriceXof();
      await this.wallet.debitForMerchantSubscription(
        user.id,
        price,
        "XOF",
        this.premiumRef(user.id),
        "Abonnement Premium commerçant"
      );
      const paidAt = new Date();
      const periodStart = startOfUtcDay(paidAt);
      await this.prisma.merchantSubscriptionInvoice.create({
        data: {
          merchantProfileId: profile.id,
          amount: price,
          currency: "XOF",
          status: MerchantSubscriptionInvoiceStatus.paid,
          billingPeriodStart: periodStart,
          billingPeriodEnd: addMonthsUtc(periodStart, 1),
          dueDate: periodStart,
          paidAt,
          providerRef
        }
      });
      await this.prisma.merchantProfile.update({
        where: { userId: user.id },
        data: { subscriptionChosenAt: new Date() }
      });
      await this.billing.activatePremium(profile.id, paidAt);
      return this.profiles.getMe(user);
    }

    throw new BadRequestException("Paiement abonnement introuvable ou déjà traité");
  }

  async confirmFromWebhook(providerRef: string, invoiceId: string) {
    await this.billing.confirmFromWebhook(providerRef, invoiceId);
  }

  async renew(user: User) {
    return this.billing.initiateRenewal(user);
  }

  async downgradeToFree(userId: string) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      include: {
        shops: {
          include: {
            products: {
              where: { status: MerchantProductStatus.published },
              orderBy: { createdAt: "asc" }
            }
          }
        }
      }
    });
    if (!profile) {
      return;
    }

    const published = profile.shops.flatMap((s) => s.products);
    const toDisable = published.slice(MERCHANT_FREE_MAX_ACTIVE_PRODUCTS);

    await this.prisma.$transaction([
      this.prisma.merchantProfile.update({
        where: { userId },
        data: {
          subscriptionTier: MerchantSubscriptionTier.free,
          subscriptionStatus: null,
          graceEndsAt: null,
          billingReminderKey: null
        }
      }),
      ...toDisable.map((p) =>
        this.prisma.merchantProduct.update({
          where: { id: p.id },
          data: {
            status: MerchantProductStatus.disabled,
            disabledAt: new Date(),
            disabledReason: MerchantProductDisabledReason.downgrade
          }
        })
      )
    ]);
  }
}
