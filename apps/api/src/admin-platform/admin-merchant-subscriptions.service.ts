import { Injectable, NotFoundException } from "@nestjs/common";
import {
  MerchantSubscriptionInvoiceStatus,
  MerchantSubscriptionStatus,
  MerchantSubscriptionPromoCodeType,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GeniusPayClient } from "../marketplace/escrow/geniuspay/geniuspay.client";
import { GENIUSPAY_CHECKOUT_BASE } from "../marketplace/escrow/geniuspay/geniuspay-mobile-money.gateway";
import { MerchantSubscriptionBillingService } from "../merchant-shop/merchant-subscription-billing.service";
import { MerchantSubscriptionPromoCodesService } from "../merchant-shop/merchant-subscription-promo-codes.service";
import { resolveMerchantPremiumBillingConfig } from "../merchant-shop/merchant-premium-billing-config";
import {
  resolveInvoiceSyncInsight,
  type MerchantSubscriptionInvoiceSyncInsight
} from "./admin-merchant-subscription-invoices.util";

@Injectable()
export class AdminMerchantSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: MerchantSubscriptionBillingService,
    private readonly promoCodes: MerchantSubscriptionPromoCodesService,
    private readonly geniusPay: GeniusPayClient
  ) {}

  async list(params: { status?: string; q?: string; take?: number }) {
    const take = Math.min(100, Math.max(1, params.take ?? 50));
    const where: Prisma.MerchantProfileWhereInput = {};
    if (params.status === "none") {
      where.subscriptionTier = null;
    } else if (params.status) {
      where.subscriptionStatus = params.status as MerchantSubscriptionStatus;
    }
    if (params.q?.trim()) {
      const q = params.q.trim();
      where.user = {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } }
        ]
      };
    }

    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "default" }
    });
    const billing = resolveMerchantPremiumBillingConfig(settings);

    const rows = await this.prisma.merchantProfile.findMany({
      where,
      take,
      orderBy: { updatedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        },
        shops: { select: { id: true } }
      }
    });

    return {
      billing: {
        fullPriceXof: billing.fullPriceXof,
        effectivePriceXof: billing.effectivePriceXof,
        billingUnit: billing.billingUnit,
        billingInterval: billing.billingInterval,
        graceDays: billing.graceDays,
        trialEnabled: billing.trialEnabled,
        trialUnits: billing.trialUnits,
        promoEnabled: billing.promoEnabled,
        promoPercentOff: billing.promoPercentOff
      },
      items: rows.map((p) => ({
        profileId: p.id,
        userId: p.user.id,
        fullName: p.user.fullName,
        email: p.user.email,
        phone: p.user.phone,
        shopCount: p.shops.length,
        subscriptionTier: p.subscriptionTier,
        subscriptionStatus: p.subscriptionStatus,
        nextBillingAt: p.nextBillingAt?.toISOString() ?? null,
        trialEndsAt: p.trialEndsAt?.toISOString() ?? null,
        promoPercentOffApplied: p.promoPercentOffApplied,
        suspendedAt: p.suspendedAt?.toISOString() ?? null,
        suspensionReason: p.suspensionReason,
        cancelledAt: p.cancelledAt?.toISOString() ?? null,
        premiumPaidAt: p.premiumPaidAt?.toISOString() ?? null
      }))
    };
  }

  async suspend(profileId: string, reason?: string) {
    await this.billing.suspendProfile(profileId, reason);
    return this.getOne(profileId);
  }

  async resume(profileId: string) {
    await this.billing.resumeProfile(profileId);
    return this.getOne(profileId);
  }

  async cancel(profileId: string, reason?: string) {
    await this.billing.cancelProfile(profileId, reason);
    return this.getOne(profileId);
  }

  async grantTrial(profileId: string, units?: number) {
    await this.billing.grantTrial(profileId, units);
    return this.getOne(profileId);
  }

  async applyPromo(profileId: string, percentOff: number) {
    await this.billing.applyPromoOverride(profileId, percentOff);
    return this.getOne(profileId);
  }

  async listPromoCodes(activeOnly?: boolean) {
    return this.promoCodes.listAdmin({ activeOnly });
  }

  async createPromoCode(
    input: {
      type: MerchantSubscriptionPromoCodeType;
      label?: string;
      code?: string;
      percentOff?: number;
      trialUnits?: number;
      maxRedemptions?: number;
      expiresAt?: Date | null;
    },
    createdByUserId?: string
  ) {
    return this.promoCodes.createAdmin({ ...input, createdByUserId });
  }

  async deactivatePromoCode(id: string) {
    return this.promoCodes.deactivateAdmin(id);
  }

  async triggerRenewal(profileId: string) {
    return this.billing.triggerRenewalCycleForProfile(profileId);
  }

  async listInvoices(params: {
    status?: string;
    q?: string;
    profileId?: string;
    take?: number;
  }) {
    const take = Math.min(100, Math.max(1, params.take ?? 50));
    const where: Prisma.MerchantSubscriptionInvoiceWhereInput = {};

    if (params.status?.trim()) {
      where.status = params.status.trim() as MerchantSubscriptionInvoiceStatus;
    }
    if (params.profileId?.trim()) {
      where.merchantProfileId = params.profileId.trim();
    }
    if (params.q?.trim()) {
      const q = params.q.trim();
      where.merchantProfile = {
        user: {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } }
          ]
        }
      };
    }

    const rows = await this.prisma.merchantSubscriptionInvoice.findMany({
      where,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        merchantProfile: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true
              }
            }
          }
        }
      }
    });

    return {
      items: rows.map((row) => this.serializeInvoice(row))
    };
  }

  async getInvoice(invoiceId: string, verify = false) {
    const row = await this.prisma.merchantSubscriptionInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        merchantProfile: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true
              }
            }
          }
        }
      }
    });
    if (!row) {
      throw new NotFoundException("Facture abonnement introuvable");
    }

    const invoice = this.serializeInvoice(row);
    if (!verify) {
      return invoice;
    }

    return {
      ...invoice,
      providerInspection: await this.inspectProviderPayment(row)
    };
  }

  private async inspectProviderPayment(
    invoice: Prisma.MerchantSubscriptionInvoiceGetPayload<{
      include: {
        merchantProfile: {
          include: {
            user: {
              select: {
                id: true;
                fullName: true;
                email: true;
                phone: true;
              };
            };
          };
        };
      };
    }>
  ) {
    const checkedAt = new Date().toISOString();
    const providerRef = invoice.providerRef?.trim() ?? null;
    const invoiceAmount = Number(invoice.amount);

    if (!providerRef) {
      return {
        checkedAt,
        providerRef,
        lookupAttempted: false,
        lookupFound: false,
        syncInsight: "no_provider_ref" as MerchantSubscriptionInvoiceSyncInsight,
        geniusPayCheckoutUrl: null
      };
    }

    if (
      providerRef.startsWith("merchant-premium:") ||
      providerRef.startsWith("merchant-sub-wallet:")
    ) {
      return {
        checkedAt,
        providerRef,
        lookupAttempted: false,
        lookupFound: false,
        syncInsight: "internal_wallet_ref" as MerchantSubscriptionInvoiceSyncInsight,
        geniusPayCheckoutUrl: null
      };
    }

    try {
      const payment = await this.geniusPay.lookupPayment(providerRef);
      if (!payment) {
        return {
          checkedAt,
          providerRef,
          lookupAttempted: true,
          lookupFound: false,
          syncInsight: resolveInvoiceSyncInsight({
            invoiceStatus: invoice.status,
            providerRef,
            lookupFound: false,
            invoiceAmount
          }),
          geniusPayCheckoutUrl: `${GENIUSPAY_CHECKOUT_BASE}/${encodeURIComponent(providerRef)}`
        };
      }

      const amountMatches =
        Math.abs(payment.amount - invoiceAmount) <= 1 ? true : false;

      return {
        checkedAt,
        providerRef,
        lookupAttempted: true,
        lookupFound: true,
        providerStatus: payment.status,
        providerAmount: payment.amount,
        providerCurrency: payment.currency,
        amountMatches,
        syncInsight: resolveInvoiceSyncInsight({
          invoiceStatus: invoice.status,
          providerRef,
          lookupFound: true,
          providerStatus: payment.status,
          providerAmount: payment.amount,
          invoiceAmount
        }),
        geniusPayCheckoutUrl:
          payment.checkout_url?.trim() ||
          payment.payment_url?.trim() ||
          `${GENIUSPAY_CHECKOUT_BASE}/${encodeURIComponent(providerRef)}`
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        checkedAt,
        providerRef,
        lookupAttempted: true,
        lookupFound: false,
        lookupError: message.slice(0, 300),
        syncInsight: "lookup_unavailable" as MerchantSubscriptionInvoiceSyncInsight,
        geniusPayCheckoutUrl: `${GENIUSPAY_CHECKOUT_BASE}/${encodeURIComponent(providerRef)}`
      };
    }
  }

  private serializeInvoice(
    row: Prisma.MerchantSubscriptionInvoiceGetPayload<{
      include: {
        merchantProfile: {
          include: {
            user: {
              select: {
                id: true;
                fullName: true;
                email: true;
                phone: true;
              };
            };
          };
        };
      };
    }>
  ) {
    const profile = row.merchantProfile;
    const user = profile.user;
    return {
      invoiceId: row.id,
      profileId: profile.id,
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      providerRef: row.providerRef,
      paymentUrl: row.paymentUrl,
      billingPeriodStart: row.billingPeriodStart.toISOString(),
      billingPeriodEnd: row.billingPeriodEnd.toISOString(),
      dueDate: row.dueDate.toISOString(),
      paidAt: row.paidAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      profileSubscriptionTier: profile.subscriptionTier,
      profileSubscriptionStatus: profile.subscriptionStatus
    };
  }

  private async getOne(profileId: string) {
    const p = await this.prisma.merchantProfile.findUnique({
      where: { id: profileId },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true }
        },
        shops: { select: { id: true } }
      }
    });
    if (!p) {
      throw new NotFoundException("Profil commerçant introuvable");
    }
    return {
      profileId: p.id,
      userId: p.user.id,
      fullName: p.user.fullName,
      email: p.user.email,
      phone: p.user.phone,
      shopCount: p.shops.length,
      subscriptionTier: p.subscriptionTier,
      subscriptionStatus: p.subscriptionStatus,
      nextBillingAt: p.nextBillingAt?.toISOString() ?? null,
      trialEndsAt: p.trialEndsAt?.toISOString() ?? null,
      promoPercentOffApplied: p.promoPercentOffApplied,
      suspendedAt: p.suspendedAt?.toISOString() ?? null,
      suspensionReason: p.suspensionReason,
      cancelledAt: p.cancelledAt?.toISOString() ?? null,
      premiumPaidAt: p.premiumPaidAt?.toISOString() ?? null
    };
  }
}
