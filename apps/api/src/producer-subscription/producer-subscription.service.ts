import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  MarketplacePaymentMethod,
  MerchantSubscriptionInvoiceStatus,
  MerchantSubscriptionTier
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UserWalletService } from "../wallet/user-wallet.service";
import {
  addBillingPeriod,
  applyPromoPercent,
  startOfUtcDay
} from "../merchant-shop/merchant-subscription.constants";
import type { ChooseProducerSubscriptionDto } from "./dto/producer-subscription.dto";
import { ProducerProfilesService } from "./producer-profiles.service";
import { ProducerSubscriptionBillingService } from "./producer-subscription-billing.service";
import { ProducerTeamAccessService } from "./producer-team-access.service";

@Injectable()
export class ProducerSubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProducerProfilesService,
    private readonly wallet: UserWalletService,
    private readonly billing: ProducerSubscriptionBillingService,
    private readonly teamAccess: ProducerTeamAccessService
  ) {}

  private premiumRef(userId: string): string {
    return `producer-premium:${userId}`;
  }

  private resolveCheckoutPrice(
    cfg: Awaited<ReturnType<ProducerSubscriptionBillingService["getBillingConfig"]>>,
    promoPercentOffApplied: number | null
  ): number {
    if (promoPercentOffApplied != null) {
      return applyPromoPercent(cfg.fullPriceXof, promoPercentOffApplied);
    }
    return cfg.effectivePriceXof;
  }

  async choose(user: User, dto: ChooseProducerSubscriptionDto) {
    const profile = await this.profiles.ensureProfile(user.id);

    if (dto.tier === MerchantSubscriptionTier.free) {
      if (profile.subscriptionTier === MerchantSubscriptionTier.premium) {
        await this.billing.cancelProfile(profile.id);
      } else {
        await this.prisma.producerProfile.update({
          where: { userId: user.id },
          data: {
            subscriptionTier: MerchantSubscriptionTier.free,
            subscriptionChosenAt: new Date()
          }
        });
        await this.teamAccess.revokeTeamAccessForOwner(user.id);
      }
      return this.profiles.getMe(user);
    }

    if (profile.subscriptionTier === MerchantSubscriptionTier.premium) {
      return this.profiles.getMe(user);
    }

    const cfg = await this.billing.getBillingConfig();

    if (dto.startTrial) {
      if (!cfg.trialEnabled) {
        throw new BadRequestException("Essai gratuit Premium indisponible");
      }
      await this.billing.activateTrial(profile.id);
      return this.profiles.getMe(user);
    }

    // Nouvelle souscription : ne pas réutiliser une remise d'un abonnement annulé
    let stickyPromo = profile.promoPercentOffApplied;
    if (stickyPromo != null) {
      await this.billing.applyPromoOverride(profile.id, null);
      stickyPromo = null;
    }

    const price = this.resolveCheckoutPrice(cfg, stickyPromo);
    const method =
      dto.paymentMethod ?? MarketplacePaymentMethod.mobile_money;

    if (method === MarketplacePaymentMethod.wallet) {
      await this.wallet.assertSufficientBalance(user.id, price);
      await this.wallet.debitForProducerSubscription(
        user.id,
        price,
        "XOF",
        this.premiumRef(user.id),
        "Abonnement Premium producteur"
      );
      const paidAt = new Date();
      const periodStart =
        cfg.billingUnit === "hour" ? paidAt : startOfUtcDay(paidAt);
      await this.prisma.producerSubscriptionInvoice.create({
        data: {
          producerProfileId: profile.id,
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
      await this.prisma.producerProfile.update({
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
    const profile = await this.prisma.producerProfile.findUnique({
      where: { userId: user.id }
    });
    if (!profile) {
      throw new NotFoundException("Profil producteur introuvable");
    }

    let invoice = await this.prisma.producerSubscriptionInvoice.findFirst({
      where: {
        producerProfileId: profile.id,
        providerRef,
        status: MerchantSubscriptionInvoiceStatus.pending
      }
    });

    if (!invoice && invoiceId?.trim()) {
      invoice = await this.prisma.producerSubscriptionInvoice.findFirst({
        where: {
          id: invoiceId.trim(),
          producerProfileId: profile.id,
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
            await this.prisma.producerProfile.update({
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
      const price = this.resolveCheckoutPrice(cfg, profile.promoPercentOffApplied);
      await this.wallet.debitForProducerSubscription(
        user.id,
        price,
        "XOF",
        this.premiumRef(user.id),
        "Abonnement Premium producteur"
      );
      const paidAt = new Date();
      const periodStart =
        cfg.billingUnit === "hour" ? paidAt : startOfUtcDay(paidAt);
      await this.prisma.producerSubscriptionInvoice.create({
        data: {
          producerProfileId: profile.id,
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
      await this.prisma.producerProfile.update({
        where: { userId: user.id },
        data: { subscriptionChosenAt: new Date() }
      });
      await this.billing.activatePremium(profile.id, paidAt);
      return this.profiles.getMe(user);
    }

    throw new BadRequestException("Paiement abonnement introuvable ou déjà traité");
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
}
