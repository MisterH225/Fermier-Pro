import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  MerchantProductDisabledReason,
  MerchantProductStatus,
  MerchantSubscriptionInvoiceStatus,
  MerchantSubscriptionReminderStage,
  MerchantSubscriptionStatus,
  MerchantSubscriptionTier,
  type MerchantProfile,
  type User
} from "@prisma/client";
import { YellikaSmsClient } from "../auth/sms/yellika-sms.client";
import { GeniusPayMobileMoneyGateway } from "../marketplace/escrow/geniuspay/geniuspay-mobile-money.gateway";
import { PrismaService } from "../prisma/prisma.service";
import { UserWalletService } from "../wallet/user-wallet.service";
import { MERCHANT_FREE_MAX_ACTIVE_PRODUCTS } from "./merchant-shop.constants";
import {
  MERCHANT_SUBSCRIPTION_GRACE_DAYS,
  addMonthsUtc,
  daysBetweenUtc,
  startOfUtcDay
} from "./merchant-subscription.constants";

@Injectable()
export class MerchantSubscriptionBillingService {
  private readonly log = new Logger(MerchantSubscriptionBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: GeniusPayMobileMoneyGateway,
    private readonly wallet: UserWalletService,
    private readonly yellika: YellikaSmsClient
  ) {}

  async getPremiumPriceXof(): Promise<number> {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "default" }
    });
    return Number(settings?.merchantPremiumPriceXof ?? 5000);
  }

  async activatePremium(profileId: string, paidAt = new Date()) {
    const nextBillingAt = addMonthsUtc(paidAt, 1);
    await this.prisma.merchantProfile.update({
      where: { id: profileId },
      data: {
        subscriptionTier: MerchantSubscriptionTier.premium,
        subscriptionStatus: MerchantSubscriptionStatus.active,
        premiumPaidAt: paidAt,
        nextBillingAt,
        graceEndsAt: null,
        billingReminderKey: null
      }
    });
  }

  async createPendingInvoice(
    profileId: string,
    userId: string,
    periodStart: Date,
    amount: number
  ) {
    const periodEnd = addMonthsUtc(periodStart, 1);
    const existing = await this.prisma.merchantSubscriptionInvoice.findUnique({
      where: {
        merchantProfileId_billingPeriodStart: {
          merchantProfileId: profileId,
          billingPeriodStart: periodStart
        }
      }
    });
    if (existing?.status === MerchantSubscriptionInvoiceStatus.paid) {
      return existing;
    }
    const invoice =
      existing ??
      (await this.prisma.merchantSubscriptionInvoice.create({
        data: {
          merchantProfileId: profileId,
          amount,
          currency: "XOF",
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          dueDate: periodStart
        }
      }));

    if (
      invoice.status === MerchantSubscriptionInvoiceStatus.pending &&
      invoice.providerRef &&
      invoice.paymentUrl
    ) {
      const resumed = await this.gateway.resumePendingCheckout(invoice.providerRef);
      if (resumed?.paymentUrl) {
        if (
          resumed.providerRef !== invoice.providerRef ||
          resumed.paymentUrl !== invoice.paymentUrl
        ) {
          return this.prisma.merchantSubscriptionInvoice.update({
            where: { id: invoice.id },
            data: {
              providerRef: resumed.providerRef,
              paymentUrl: resumed.paymentUrl
            }
          });
        }
        return invoice;
      }
    }

    const init = await this.gateway.initiateMerchantSubscriptionPayment({
      amount,
      currency: "XOF",
      userId,
      invoiceId: invoice.id,
      label: "Abonnement Premium commerçant Fermier Pro"
    });

    const updated = await this.prisma.merchantSubscriptionInvoice.update({
      where: { id: invoice.id },
      data: {
        providerRef: init.providerRef,
        paymentUrl: init.paymentUrl ?? null
      }
    });

    await this.notifySubscriptionCheckoutLink(userId, amount, updated.paymentUrl);

    return updated;
  }

  private async notifySubscriptionCheckoutLink(
    userId: string,
    amount: number,
    paymentUrl: string | null
  ) {
    if (!paymentUrl?.trim()) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, email: true }
    });
    if (!user) {
      return;
    }

    const amountLabel = amount.toLocaleString("fr-FR");
    const message = `Fermier Pro: activez votre Premium (${amountLabel} XOF): ${paymentUrl}`;
    const phone = user.phone?.trim();

    if (phone) {
      await this.sendSmsSafe(phone, message, userId);
      return;
    }

    const email = user.email?.trim();
    if (email) {
      await this.sendCheckoutEmailSafe(
        email,
        "Lien de paiement Premium Fermier Pro",
        `<p>Bonjour,</p><p>Voici votre lien pour activer l'abonnement Premium commerçant (${amountLabel} XOF/mois)&nbsp;:</p><p><a href="${paymentUrl}">Payer maintenant</a></p><p>Votre abonnement sera activé automatiquement après confirmation du paiement.</p>`
      );
    } else {
      this.log.warn(`Pas de téléphone ni email pour lien abo userId=${userId}`);
    }
  }

  private async sendCheckoutEmailSafe(
    email: string,
    subject: string,
    html: string
  ) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from =
      process.env.TRANSACTIONAL_EMAIL_FROM?.trim() ??
      "Fermier Pro <noreply@fermierpro.com>";

    if (!apiKey) {
      this.log.log(`[email dry-run] to=${email}: ${subject}`);
      return;
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: [email.trim().toLowerCase()],
          subject,
          html
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 300));
      }
      this.log.log(`Email abonnement envoyé to=${email}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn(`Email abonnement non envoyé to=${email}: ${msg}`);
    }
  }

  async markInvoicePaid(invoiceId: string, paidAt = new Date()) {
    const invoice = await this.prisma.merchantSubscriptionInvoice.findUnique({
      where: { id: invoiceId }
    });
    if (!invoice) {
      throw new NotFoundException("Facture abonnement introuvable");
    }
    if (invoice.status === MerchantSubscriptionInvoiceStatus.paid) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.merchantSubscriptionInvoice.update({
        where: { id: invoiceId },
        data: {
          status: MerchantSubscriptionInvoiceStatus.paid,
          paidAt
        }
      }),
      this.prisma.merchantProfile.update({
        where: { id: invoice.merchantProfileId },
        data: {
          subscriptionTier: MerchantSubscriptionTier.premium,
          subscriptionStatus: MerchantSubscriptionStatus.active,
          premiumPaidAt: paidAt,
          nextBillingAt: invoice.billingPeriodEnd,
          graceEndsAt: null,
          billingReminderKey: null
        }
      })
    ]);
  }

  async confirmInvoicePayment(providerRef: string, invoiceId: string) {
    const res = await this.gateway.confirmMerchantSubscriptionPayment(
      providerRef,
      invoiceId
    );
    if (!res.success) {
      throw new NotFoundException(
        res.failureReason ?? "Paiement abonnement non confirmé"
      );
    }
    await this.markInvoicePaid(invoiceId);
  }

  async confirmFromWebhook(providerRef: string, invoiceId: string) {
    await this.confirmInvoicePayment(providerRef, invoiceId);
  }

  async tryWalletRenewal(userId: string, profile: MerchantProfile, amount: number) {
    try {
      await this.wallet.assertSufficientBalance(userId, amount);
    } catch {
      return false;
    }
    const ref = `merchant-sub-wallet:${profile.id}:${startOfUtcDay(new Date()).toISOString()}`;
    await this.wallet.debitForMerchantSubscription(
      userId,
      amount,
      "XOF",
      ref,
      "Renouvellement Premium commerçant"
    );
    const paidAt = new Date();
    const periodStart = profile.nextBillingAt ?? paidAt;
    await this.prisma.merchantSubscriptionInvoice.create({
      data: {
        merchantProfileId: profile.id,
        amount,
        currency: "XOF",
        status: MerchantSubscriptionInvoiceStatus.paid,
        billingPeriodStart: periodStart,
        billingPeriodEnd: addMonthsUtc(periodStart, 1),
        dueDate: periodStart,
        paidAt,
        providerRef: ref
      }
    });
    await this.activatePremium(profile.id, paidAt);
    this.log.log(`Renouvellement wallet Premium userId=${userId}`);
    return true;
  }

  async runDailyBillingCycle(): Promise<void> {
    const today = startOfUtcDay(new Date());
    const price = await this.getPremiumPriceXof();
    const profiles = await this.prisma.merchantProfile.findMany({
      where: { subscriptionTier: MerchantSubscriptionTier.premium },
      include: { user: { select: { id: true, phone: true } } }
    });

    for (const profile of profiles) {
      try {
        await this.processProfileBilling(profile, today, price);
      } catch (err) {
        this.log.error(
          `Billing cycle profile=${profile.id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  private async processProfileBilling(
    profile: MerchantProfile & { user: { id: string; phone: string | null } },
    today: Date,
    price: number
  ) {
    if (!profile.nextBillingAt) {
      if (profile.premiumPaidAt) {
        await this.prisma.merchantProfile.update({
          where: { id: profile.id },
          data: {
            nextBillingAt: addMonthsUtc(profile.premiumPaidAt, 1),
            subscriptionStatus: MerchantSubscriptionStatus.active
          }
        });
      }
      return;
    }

    const billingDay = startOfUtcDay(profile.nextBillingAt);
    const daysUntilDue = daysBetweenUtc(today, billingDay);
    const daysPastDue = daysBetweenUtc(billingDay, today);

    if (
      profile.subscriptionStatus === MerchantSubscriptionStatus.past_due &&
      profile.graceEndsAt &&
      daysBetweenUtc(startOfUtcDay(profile.graceEndsAt), today) >= 0
    ) {
      await this.expirePremium(profile);
      return;
    }

    if (daysUntilDue === 3) {
      await this.sendBillingReminder(profile, billingDay, price, "j_minus_3", null);
      return;
    }

    if (daysUntilDue === 0) {
      const walletPaid = await this.tryWalletRenewal(
        profile.user.id,
        profile,
        price
      );
      if (walletPaid) {
        return;
      }

      const invoice = await this.createPendingInvoice(
        profile.id,
        profile.user.id,
        billingDay,
        price
      );

      await this.prisma.merchantProfile.update({
        where: { id: profile.id },
        data: {
          subscriptionStatus: MerchantSubscriptionStatus.past_due,
          graceEndsAt: new Date(
            billingDay.getTime() +
              MERCHANT_SUBSCRIPTION_GRACE_DAYS * 86_400_000
          )
        }
      });

      await this.sendBillingReminder(
        profile,
        billingDay,
        price,
        "j0",
        invoice.paymentUrl ?? null,
        invoice.id
      );
      return;
    }

    if (
      profile.subscriptionStatus === MerchantSubscriptionStatus.past_due &&
      daysPastDue === 3
    ) {
      const invoice = await this.findOpenInvoice(profile.id, billingDay);
      await this.sendBillingReminder(
        profile,
        billingDay,
        price,
        "j_plus_3",
        invoice?.paymentUrl ?? null,
        invoice?.id
      );
    }
  }

  private async findOpenInvoice(profileId: string, periodStart: Date) {
    return this.prisma.merchantSubscriptionInvoice.findUnique({
      where: {
        merchantProfileId_billingPeriodStart: {
          merchantProfileId: profileId,
          billingPeriodStart: periodStart
        }
      }
    });
  }

  private async sendBillingReminder(
    profile: MerchantProfile & { user: { id: string; phone: string | null } },
    billingDay: Date,
    price: number,
    stage: "j_minus_3" | "j0" | "j_plus_3",
    paymentUrl: string | null,
    invoiceId?: string
  ) {
    const reminderKey = `${billingDay.toISOString().slice(0, 10)}:${stage}`;
    if (profile.billingReminderKey === reminderKey) {
      return;
    }

    const stageEnum =
      stage === "j_minus_3"
        ? MerchantSubscriptionReminderStage.j_minus_3
        : stage === "j0"
          ? MerchantSubscriptionReminderStage.j0
          : MerchantSubscriptionReminderStage.j_plus_3;

    if (invoiceId) {
      await this.prisma.merchantSubscriptionInvoice.update({
        where: { id: invoiceId },
        data: { reminderStage: stageEnum }
      });
    }

    const phone = profile.user.phone?.trim();
    const amountLabel = price.toLocaleString("fr-FR");
    const graceEnd = profile.graceEndsAt
      ? profile.graceEndsAt.toLocaleDateString("fr-FR")
      : "";
    const message =
      stage === "j_minus_3"
        ? `Fermier Pro: votre Premium commerçant renouvelle dans 3 jours (${amountLabel} XOF).`
        : stage === "j0"
          ? paymentUrl
            ? `Fermier Pro: renouvelez votre Premium (${amountLabel} XOF): ${paymentUrl}`
            : `Fermier Pro: renouvelez votre Premium (${amountLabel} XOF) depuis l'application.`
          : paymentUrl
            ? `Fermier Pro: rappel Premium impayé. Payez avant le ${graceEnd}: ${paymentUrl}`
            : `Fermier Pro: rappel Premium impayé. Payez avant le ${graceEnd} depuis l'application.`;

    if (phone) {
      await this.sendSmsSafe(phone, message, profile.id);
    } else {
      this.log.warn(`Pas de téléphone pour rappel abo profile=${profile.id}`);
      this.log.log(`[SMS log] profile=${profile.id}: ${message}`);
    }

    await this.prisma.merchantProfile.update({
      where: { id: profile.id },
      data: { billingReminderKey: reminderKey }
    });
  }

  private async expirePremium(
    profile: MerchantProfile & { user: { id: string; phone: string | null } }
  ) {
    const billingDay = profile.nextBillingAt
      ? startOfUtcDay(profile.nextBillingAt)
      : null;
    if (billingDay) {
      await this.prisma.merchantSubscriptionInvoice.updateMany({
        where: {
          merchantProfileId: profile.id,
          billingPeriodStart: billingDay,
          status: MerchantSubscriptionInvoiceStatus.pending
        },
        data: { status: MerchantSubscriptionInvoiceStatus.expired }
      });
    }

    const full = await this.prisma.merchantProfile.findUnique({
      where: { id: profile.id },
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
    if (!full) {
      return;
    }

    const published = full.shops.flatMap((s) => s.products);
    const toDisable = published.slice(MERCHANT_FREE_MAX_ACTIVE_PRODUCTS);

    await this.prisma.$transaction([
      this.prisma.merchantProfile.update({
        where: { id: profile.id },
        data: {
          subscriptionTier: MerchantSubscriptionTier.free,
          subscriptionStatus: null,
          graceEndsAt: null,
          billingReminderKey: null
        }
      }),
      ...toDisable.map((prod) =>
        this.prisma.merchantProduct.update({
          where: { id: prod.id },
          data: {
            status: MerchantProductStatus.disabled,
            disabledAt: new Date(),
            disabledReason: MerchantProductDisabledReason.downgrade
          }
        })
      )
    ]);

    const phone = profile.user.phone?.trim();
    if (phone) {
      await this.sendSmsSafe(
        phone,
        "Fermier Pro: votre Premium commerçant a expiré. Réabonnez-vous depuis l'application.",
        profile.id
      );
    }
  }

  private async sendSmsSafe(phone: string, message: string, profileId: string) {
    if (process.env.MERCHANT_SUBSCRIPTION_SMS_ENABLED === "false") {
      this.log.log(`[SMS dry-run] profile=${profileId}: ${message}`);
      return;
    }
    try {
      await this.yellika.sendPlainText(phone, message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn(`SMS abonnement non envoyé profile=${profileId}: ${msg}`);
      this.log.log(`[SMS fallback log] profile=${profileId}: ${message}`);
    }
  }

  async getPendingRenewal(user: User) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId: user.id }
    });
    if (!profile || profile.subscriptionTier !== MerchantSubscriptionTier.premium) {
      return null;
    }
    const invoice = await this.prisma.merchantSubscriptionInvoice.findFirst({
      where: {
        merchantProfileId: profile.id,
        status: MerchantSubscriptionInvoiceStatus.pending
      },
      orderBy: { dueDate: "desc" }
    });
    if (!invoice) {
      return null;
    }
    return {
      invoiceId: invoice.id,
      amount: Number(invoice.amount),
      currency: invoice.currency,
      paymentUrl: invoice.paymentUrl,
      providerRef: invoice.providerRef,
      dueDate: invoice.dueDate.toISOString(),
      graceEndsAt: profile.graceEndsAt?.toISOString() ?? null
    };
  }

  async initiateRenewal(user: User) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId: user.id }
    });
    if (!profile || profile.subscriptionTier !== MerchantSubscriptionTier.premium) {
      throw new NotFoundException("Abonnement Premium actif requis");
    }
    const price = await this.getPremiumPriceXof();
    const periodStart = profile.nextBillingAt
      ? startOfUtcDay(profile.nextBillingAt)
      : startOfUtcDay(new Date());
    const invoice = await this.createPendingInvoice(
      profile.id,
      user.id,
      periodStart,
      price
    );
    return {
      pending: true,
      invoiceId: invoice.id,
      amount: Number(invoice.amount),
      providerRef: invoice.providerRef,
      paymentUrl: invoice.paymentUrl
    };
  }
}
