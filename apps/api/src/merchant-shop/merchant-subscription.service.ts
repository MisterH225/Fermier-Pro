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
  MerchantSubscriptionPromoCodeType,
  MerchantSubscriptionTier
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UserWalletService } from "../wallet/user-wallet.service";
import type { ChooseMerchantSubscriptionDto } from "./dto/merchant-shop.dto";
import { MerchantProfilesService } from "./merchant-profiles.service";
import { MerchantSubscriptionBillingService } from "./merchant-subscription-billing.service";
import { MERCHANT_FREE_MAX_ACTIVE_PRODUCTS } from "./merchant-shop.constants";
import {
  addBillingPeriod,
  applyPromoPercent,
  startOfUtcDay
} from "./merchant-subscription.constants";
import { MerchantSubscriptionPromoCodesService } from "./merchant-subscription-promo-codes.service";

@Injectable()
export class MerchantSubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: MerchantProfilesService,
    private readonly wallet: UserWalletService,
    private readonly billing: MerchantSubscriptionBillingService,
    private readonly promoCodes: MerchantSubscriptionPromoCodesService
  ) {}

  private resolveCheckoutPrice(
    cfg: Awaited<ReturnType<MerchantSubscriptionBillingService["getBillingConfig"]>>,
    promoPercentOffApplied: number | null,
    overridePriceXof?: number | null
  ): number {
    if (overridePriceXof != null) {
      return overridePriceXof;
    }
    if (promoPercentOffApplied != null) {
      return applyPromoPercent(cfg.fullPriceXof, promoPercentOffApplied);
    }
    return cfg.effectivePriceXof;
  }

  private premiumRef(userId: string): string {
    return `merchant-premium:${userId}`;
  }

  async validatePromoCode(user: User, code: string) {
    const profile = await this.profiles.ensureProfile(user.id);
    return this.promoCodes.previewForMerchant(profile.id, code);
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

    const cfg = await this.billing.getBillingConfig();

    let checkoutPriceOverride: number | null = null;

    if (dto.promoCode?.trim()) {
      const benefit = await this.promoCodes.redeemForMerchant(
        profile.id,
        dto.promoCode
      );
      if (benefit.type === MerchantSubscriptionPromoCodeType.trial) {
        await this.billing.grantTrial(profile.id, benefit.trialUnits ?? undefined);
        return this.profiles.getMe(user);
      }
      if (benefit.percentOff != null) {
        await this.billing.applyPromoOverride(profile.id, benefit.percentOff);
        checkoutPriceOverride = benefit.discountedPriceXof;
      }
    } else if (dto.startTrial) {
      if (!cfg.trialEnabled) {
        throw new BadRequestException("Essai gratuit Premium indisponible");
      }
      await this.billing.activateTrial(profile.id);
      return this.profiles.getMe(user);
    }

    const price =
      checkoutPriceOverride ??
      this.resolveCheckoutPrice(cfg, profile.promoPercentOffApplied);
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
      const periodStart =
        cfg.billingUnit === "hour" ? paidAt : startOfUtcDay(paidAt);
      await this.prisma.merchantSubscriptionInvoice.create({
        data: {
          merchantProfileId: profile.id,
          amount: price,
          currency: "XOF",
          status: MerchantSubscriptionInvoiceStatus.paid,
          billingPeriodStart: periodStart,
          billingPeriodEnd: addBillingPeriod(
            periodStart,
            cfg.billingUnit,
            cfg.billingInterval
          ),
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

    const periodStart =
      cfg.billingUnit === "hour" ? new Date() : startOfUtcDay(new Date());
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

  async confirmPremiumPayment(
    user: User,
    providerRef: string,
    invoiceId?: string
  ) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId: user.id }
    });
    if (!profile) {
      throw new NotFoundException("Profil commerçant introuvable");
    }

    let invoice = await this.prisma.merchantSubscriptionInvoice.findFirst({
      where: {
        merchantProfileId: profile.id,
        providerRef,
        status: MerchantSubscriptionInvoiceStatus.pending
      }
    });

    if (!invoice && invoiceId?.trim()) {
      invoice = await this.prisma.merchantSubscriptionInvoice.findFirst({
        where: {
          id: invoiceId.trim(),
          merchantProfileId: profile.id,
          status: MerchantSubscriptionInvoiceStatus.pending
        }
      });
    }

    if (invoice) {
      const refsToTry = [
        providerRef.trim(),
        invoice.providerRef?.trim() ?? ""
      ].filter((ref, index, arr) => ref.length > 0 && arr.indexOf(ref) === index);

      let lastError: unknown;
      for (const ref of refsToTry) {
        try {
          await this.billing.confirmInvoicePayment(ref, invoice.id);
          if (!profile.subscriptionChosenAt) {
            await this.prisma.merchantProfile.update({
              where: { userId: user.id },
              data: { subscriptionChosenAt: new Date() }
            });
          }
          return this.profiles.getMe(user);
        } catch (err) {
          lastError = err;
        }
      }
      if (lastError instanceof NotFoundException) {
        throw lastError;
      }
      if (lastError instanceof Error) {
        throw new BadRequestException(lastError.message);
      }
      throw new BadRequestException("Paiement abonnement non confirmé");
    }

    if (this.wallet.isWalletPendingRef(providerRef)) {
      const cfg = await this.billing.getBillingConfig();
      const price = cfg.effectivePriceXof;
      await this.wallet.debitForMerchantSubscription(
        user.id,
        price,
        "XOF",
        this.premiumRef(user.id),
        "Abonnement Premium commerçant"
      );
      const paidAt = new Date();
      const periodStart =
        cfg.billingUnit === "hour" ? paidAt : startOfUtcDay(paidAt);
      await this.prisma.merchantSubscriptionInvoice.create({
        data: {
          merchantProfileId: profile.id,
          amount: price,
          currency: "XOF",
          status: MerchantSubscriptionInvoiceStatus.paid,
          billingPeriodStart: periodStart,
          billingPeriodEnd: addBillingPeriod(
            periodStart,
            cfg.billingUnit,
            cfg.billingInterval
          ),
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

  async cancel(user: User) {
    const profile = await this.profiles.ensureProfile(user.id);
    if (profile.subscriptionTier !== MerchantSubscriptionTier.premium) {
      throw new BadRequestException("Aucun abonnement Premium actif à annuler");
    }
    await this.billing.cancelProfile(profile.id);
    return this.profiles.getMe(user);
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
