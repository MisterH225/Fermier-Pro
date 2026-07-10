import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  MerchantSubscriptionInvoiceStatus,
  MerchantSubscriptionReminderStage,
  MerchantSubscriptionStatus,
  MerchantSubscriptionTier,
  type ProducerProfile,
  type User
} from "@prisma/client";
import { YellikaSmsClient } from "../auth/sms/yellika-sms.client";
import { GeniusPayMobileMoneyGateway } from "../marketplace/escrow/geniuspay/geniuspay-mobile-money.gateway";
import { PrismaService } from "../prisma/prisma.service";
import { UserWalletService } from "../wallet/user-wallet.service";
import {
  MERCHANT_SUBSCRIPTION_GRACE_DAYS,
  addBillingPeriod,
  billingPeriodStart,
  billingReminderKey,
  graceDurationMs,
  periodsBetweenUtc,
  daysBetweenUtc,
  startOfUtcDay
} from "../merchant-shop/merchant-subscription.constants";
import { resolveProducerPremiumBillingConfig } from "./producer-premium-billing-config";
import { ProducerTeamAccessService } from "./producer-team-access.service";

@Injectable()
export class ProducerSubscriptionBillingService {
  private readonly log = new Logger(ProducerSubscriptionBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: GeniusPayMobileMoneyGateway,
    private readonly wallet: UserWalletService,
    private readonly yellika: YellikaSmsClient,
    private readonly producerTeam: ProducerTeamAccessService
  ) {}

  async getPremiumPriceXof(): Promise<number> {
    const cfg = await this.getBillingConfig();
    return cfg.effectivePriceXof;
  }

  async getBillingConfig() {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "default" }
    });
    return resolveProducerPremiumBillingConfig(settings);
  }

  async activatePremium(profileId: string, paidAt = new Date()) {
    const cfg = await this.getBillingConfig();
    const existing = await this.prisma.producerProfile.findUnique({
      where: { id: profileId },
      select: { promoPercentOffApplied: true }
    });
    const promoPercentOffApplied =
      existing?.promoPercentOffApplied ??
      (cfg.promoEnabled ? cfg.promoPercentOff : null);
    const nextBillingAt = addBillingPeriod(
      paidAt,
      cfg.billingUnit,
      cfg.billingInterval
    );
    await this.prisma.producerProfile.update({
      where: { id: profileId },
      data: {
        subscriptionTier: MerchantSubscriptionTier.premium,
        subscriptionStatus: MerchantSubscriptionStatus.active,
        premiumPaidAt: paidAt,
        nextBillingAt,
        graceEndsAt: null,
        billingReminderKey: null,
        trialEndsAt: null,
        cancelledAt: null,
        suspendedAt: null,
        suspensionReason: null,
        promoPercentOffApplied
      }
    });
  }

  async activateTrial(profileId: string, from = new Date()) {
    const cfg = await this.getBillingConfig();
    if (!cfg.trialEnabled) {
      throw new NotFoundException("Essai gratuit Premium désactivé");
    }
    const trialEndsAt = addBillingPeriod(
      from,
      cfg.billingUnit,
      cfg.trialUnits
    );
    await this.prisma.producerProfile.update({
      where: { id: profileId },
      data: {
        subscriptionTier: MerchantSubscriptionTier.premium,
        subscriptionStatus: MerchantSubscriptionStatus.trialing,
        subscriptionChosenAt: from,
        premiumPaidAt: null,
        nextBillingAt: trialEndsAt,
        trialEndsAt,
        graceEndsAt: null,
        billingReminderKey: null,
        cancelledAt: null,
        suspendedAt: null,
        suspensionReason: null
      }
    });
  }

  async createPendingInvoice(
    profileId: string,
    userId: string,
    periodStart: Date,
    amount: number
  ) {
    const cfg = await this.getBillingConfig();
    const periodEnd = addBillingPeriod(
      periodStart,
      cfg.billingUnit,
      cfg.billingInterval
    );
    const existing = await this.prisma.producerSubscriptionInvoice.findUnique({
      where: {
        producerProfileId_billingPeriodStart: {
          producerProfileId: profileId,
          billingPeriodStart: periodStart
        }
      }
    });
    if (existing?.status === MerchantSubscriptionInvoiceStatus.paid) {
      return existing;
    }
    const invoice =
      existing ??
      (await this.prisma.producerSubscriptionInvoice.create({
        data: {
          producerProfileId: profileId,
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
          return this.prisma.producerSubscriptionInvoice.update({
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

    const init = await this.gateway.initiateProducerSubscriptionPayment({
      amount,
      currency: "XOF",
      userId,
      invoiceId: invoice.id,
      label: "Abonnement Premium producteur Fermier Pro"
    });

    const updated = await this.prisma.producerSubscriptionInvoice.update({
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
        `<p>Bonjour,</p><p>Voici votre lien pour activer l'abonnement Premium producteur (${amountLabel} XOF/mois)&nbsp;:</p><p><a href="${paymentUrl}">Payer maintenant</a></p><p>Votre abonnement sera activé automatiquement après confirmation du paiement.</p>`
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
    const invoice = await this.prisma.producerSubscriptionInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        producerProfile: { select: { subscriptionChosenAt: true } }
      }
    });
    if (!invoice) {
      throw new NotFoundException("Facture abonnement introuvable");
    }
    if (invoice.status === MerchantSubscriptionInvoiceStatus.paid) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.producerSubscriptionInvoice.update({
        where: { id: invoiceId },
        data: {
          status: MerchantSubscriptionInvoiceStatus.paid,
          paidAt
        }
      }),
      this.prisma.producerProfile.update({
        where: { id: invoice.producerProfileId },
        data: {
          subscriptionTier: MerchantSubscriptionTier.premium,
          subscriptionStatus: MerchantSubscriptionStatus.active,
          premiumPaidAt: paidAt,
          nextBillingAt: invoice.billingPeriodEnd,
          graceEndsAt: null,
          billingReminderKey: null,
          ...(invoice.producerProfile.subscriptionChosenAt
            ? {}
            : { subscriptionChosenAt: paidAt })
        }
      })
    ]);
  }

  async confirmInvoicePayment(providerRef: string, invoiceId: string) {
    const res = await this.gateway.confirmProducerSubscriptionPayment(
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

  /**
   * Confirmation asynchrone via webhook GeniusPay signé.
   * Ne re-interroge pas GET /payments/{ref} : en sandbox GeniusPay le lookup
   * échoue souvent (TRANSACTION_NOT_FOUND) alors que payment.success est fiable.
   */
  async confirmFromWebhook(
    providerRef: string,
    invoiceId: string,
    webhookAmount?: number
  ) {
    const invoice = await this.prisma.producerSubscriptionInvoice.findUnique({
      where: { id: invoiceId }
    });
    if (!invoice) {
      throw new NotFoundException("Facture abonnement introuvable");
    }
    if (invoice.status === MerchantSubscriptionInvoiceStatus.paid) {
      return;
    }
    if (invoice.status !== MerchantSubscriptionInvoiceStatus.pending) {
      throw new NotFoundException("Facture abonnement non en attente");
    }

    const ref = providerRef.trim();
    if (!ref) {
      throw new NotFoundException("Référence GeniusPay manquante");
    }

    if (webhookAmount !== undefined && Number.isFinite(webhookAmount)) {
      const expected = Number(invoice.amount);
      if (Math.abs(webhookAmount - expected) > 1) {
        this.log.warn(
          `Webhook montant incohérent invoice=${invoiceId} webhook=${webhookAmount} expected=${expected}`
        );
        throw new NotFoundException("Montant webhook incohérent avec la facture");
      }
    }

    if (invoice.providerRef && invoice.providerRef !== ref) {
      this.log.warn(
        `Webhook ref=${ref} différente de facture ref=${invoice.providerRef} invoice=${invoiceId} — mise à jour`
      );
      await this.prisma.producerSubscriptionInvoice.update({
        where: { id: invoiceId },
        data: { providerRef: ref }
      });
    } else if (!invoice.providerRef) {
      await this.prisma.producerSubscriptionInvoice.update({
        where: { id: invoiceId },
        data: { providerRef: ref }
      });
    }

    await this.markInvoicePaid(invoiceId);
    this.log.log(
      `Premium activé via webhook GeniusPay invoice=${invoiceId} ref=${ref}`
    );
  }

  /**
   * Résout une facture en attente à partir de la référence GeniusPay seule
   * (metadata.kind / invoice_id parfois absents du webhook sandbox).
   */
  async confirmFromWebhookByProviderRef(
    providerRef: string,
    webhookAmount?: number
  ): Promise<boolean> {
    const ref = providerRef.trim();
    if (!ref) {
      return false;
    }

    const invoice = await this.prisma.producerSubscriptionInvoice.findFirst({
      where: {
        providerRef: ref,
        status: MerchantSubscriptionInvoiceStatus.pending
      }
    });
    if (!invoice) {
      return false;
    }

    await this.confirmFromWebhook(ref, invoice.id, webhookAmount);
    return true;
  }

  async tryWalletRenewal(userId: string, profile: ProducerProfile, amount: number) {
    try {
      await this.wallet.assertSufficientBalance(userId, amount);
    } catch {
      return false;
    }
    const cfg = await this.getBillingConfig();
    const ref = `producer-sub-wallet:${profile.id}:${billingPeriodStart(new Date(), cfg.billingUnit).toISOString()}`;
    await this.wallet.debitForProducerSubscription(
      userId,
      amount,
      "XOF",
      ref,
      "Renouvellement Premium producteur"
    );
    const paidAt = new Date();
    const periodStart = profile.nextBillingAt
      ? billingPeriodStart(profile.nextBillingAt, cfg.billingUnit)
      : paidAt;
    await this.prisma.producerSubscriptionInvoice.create({
      data: {
        producerProfileId: profile.id,
        amount,
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
        providerRef: ref
      }
    });
    await this.activatePremium(profile.id, paidAt);
    this.log.log(`Renouvellement wallet Premium userId=${userId}`);
    return true;
  }

  async runDailyBillingCycle(): Promise<void> {
    await this.runBillingCycle(new Date());
  }

  async runBillingCycle(now = new Date()): Promise<void> {
    const cfg = await this.getBillingConfig();
    const price = cfg.effectivePriceXof;
    const profiles = await this.prisma.producerProfile.findMany({
      where: {
        subscriptionTier: MerchantSubscriptionTier.premium,
        subscriptionStatus: {
          in: [
            MerchantSubscriptionStatus.active,
            MerchantSubscriptionStatus.past_due,
            MerchantSubscriptionStatus.trialing
          ]
        }
      },
      include: { user: { select: { id: true, phone: true } } }
    });

    for (const profile of profiles) {
      try {
        if (profile.subscriptionStatus === MerchantSubscriptionStatus.suspended) {
          continue;
        }
        await this.processProfileBilling(
          profile,
          now,
          price,
          cfg.graceDays,
          cfg.billingUnit,
          cfg.billingInterval
        );
      } catch (err) {
        this.log.error(
          `Billing cycle profile=${profile.id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  /**
   * Recalcule `nextBillingAt` des Premium actifs après un changement
   * de périodicité admin (ex. month → hour pour tests).
   */
  async realignActiveNextBillingAt(
    billingUnit: "hour" | "day" | "month",
    billingInterval: number
  ): Promise<number> {
    const profiles = await this.prisma.producerProfile.findMany({
      where: {
        subscriptionTier: MerchantSubscriptionTier.premium,
        subscriptionStatus: {
          in: [
            MerchantSubscriptionStatus.active,
            MerchantSubscriptionStatus.trialing
          ]
        },
        OR: [{ premiumPaidAt: { not: null } }, { trialEndsAt: { not: null } }]
      },
      select: {
        id: true,
        premiumPaidAt: true,
        trialEndsAt: true,
        subscriptionStatus: true,
        nextBillingAt: true
      }
    });

    let updated = 0;
    const now = Date.now();
    for (const profile of profiles) {
      const anchor =
        profile.subscriptionStatus === MerchantSubscriptionStatus.trialing
          ? (profile.trialEndsAt ?? profile.premiumPaidAt)
          : (profile.premiumPaidAt ?? profile.trialEndsAt);
      if (!anchor) {
        continue;
      }
      let next = addBillingPeriod(anchor, billingUnit, billingInterval);
      while (next.getTime() <= now) {
        next = addBillingPeriod(next, billingUnit, billingInterval);
      }
      if (
        profile.nextBillingAt &&
        Math.abs(profile.nextBillingAt.getTime() - next.getTime()) < 1000
      ) {
        continue;
      }
      await this.prisma.producerProfile.update({
        where: { id: profile.id },
        data: {
          nextBillingAt: next,
          billingReminderKey: null,
          ...(profile.subscriptionStatus === MerchantSubscriptionStatus.trialing
            ? { trialEndsAt: next }
            : {})
        }
      });
      updated += 1;
    }
    return updated;
  }

  private async processProfileBilling(
    profile: ProducerProfile & { user: { id: string; phone: string | null } },
    now: Date,
    price: number,
    graceDays: number,
    billingUnit: "hour" | "day" | "month",
    billingInterval: number
  ) {
    if (
      profile.subscriptionStatus === MerchantSubscriptionStatus.trialing &&
      profile.trialEndsAt &&
      profile.trialEndsAt.getTime() <= now.getTime()
    ) {
      await this.prisma.producerProfile.update({
        where: { id: profile.id },
        data: {
          subscriptionStatus: MerchantSubscriptionStatus.active,
          trialEndsAt: null
        }
      });
      profile.subscriptionStatus = MerchantSubscriptionStatus.active;
    }

    if (!profile.nextBillingAt) {
      if (profile.premiumPaidAt) {
        await this.prisma.producerProfile.update({
          where: { id: profile.id },
          data: {
            nextBillingAt: addBillingPeriod(
              profile.premiumPaidAt,
              billingUnit,
              billingInterval
            ),
            subscriptionStatus: MerchantSubscriptionStatus.active
          }
        });
      }
      return;
    }

    const periodStart = billingPeriodStart(profile.nextBillingAt, billingUnit);
    const dueReached = profile.nextBillingAt.getTime() <= now.getTime();
    // Rappels « −3 / +3 » : heures si billing horaire, sinon jours calendaires.
    const periodsUntilDue =
      billingUnit === "hour"
        ? periodsBetweenUtc(
            now,
            profile.nextBillingAt,
            billingUnit,
            billingInterval
          )
        : daysBetweenUtc(startOfUtcDay(now), startOfUtcDay(profile.nextBillingAt));
    const periodsPastDue =
      billingUnit === "hour"
        ? periodsBetweenUtc(
            profile.nextBillingAt,
            now,
            billingUnit,
            billingInterval
          )
        : daysBetweenUtc(startOfUtcDay(profile.nextBillingAt), startOfUtcDay(now));

    if (
      profile.subscriptionStatus === MerchantSubscriptionStatus.past_due &&
      profile.graceEndsAt &&
      profile.graceEndsAt.getTime() <= now.getTime()
    ) {
      await this.expirePremium(profile);
      return;
    }

    if (periodsUntilDue === 3 && !dueReached) {
      await this.sendBillingReminder(
        profile,
        periodStart,
        price,
        "j_minus_3",
        null,
        undefined,
        billingUnit
      );
      return;
    }

    if (dueReached && profile.subscriptionStatus !== MerchantSubscriptionStatus.past_due) {
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
        periodStart,
        price
      );

      const resolvedGrace =
        graceDays > 0 ? graceDays : MERCHANT_SUBSCRIPTION_GRACE_DAYS;

      await this.prisma.producerProfile.update({
        where: { id: profile.id },
        data: {
          subscriptionStatus: MerchantSubscriptionStatus.past_due,
          graceEndsAt: new Date(
            Math.max(profile.nextBillingAt.getTime(), now.getTime()) +
              graceDurationMs(resolvedGrace, billingUnit)
          )
        }
      });

      await this.sendBillingReminder(
        profile,
        periodStart,
        price,
        "j0",
        invoice.paymentUrl ?? null,
        invoice.id,
        billingUnit
      );
      return;
    }

    if (
      profile.subscriptionStatus === MerchantSubscriptionStatus.past_due &&
      periodsPastDue === 3
    ) {
      const invoice = await this.findOpenInvoice(profile.id, periodStart);
      await this.sendBillingReminder(
        profile,
        periodStart,
        price,
        "j_plus_3",
        invoice?.paymentUrl ?? null,
        invoice?.id,
        billingUnit
      );
    }
  }

  private async findOpenInvoice(profileId: string, periodStart: Date) {
    return this.prisma.producerSubscriptionInvoice.findUnique({
      where: {
        producerProfileId_billingPeriodStart: {
          producerProfileId: profileId,
          billingPeriodStart: periodStart
        }
      }
    });
  }

  private async sendBillingReminder(
    profile: ProducerProfile & { user: { id: string; phone: string | null } },
    billingAt: Date,
    price: number,
    stage: "j_minus_3" | "j0" | "j_plus_3",
    paymentUrl: string | null,
    invoiceId?: string,
    billingUnit: "hour" | "day" | "month" = "month"
  ) {
    const reminderKey = billingReminderKey(billingAt, stage, billingUnit);
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
      await this.prisma.producerSubscriptionInvoice.update({
        where: { id: invoiceId },
        data: { reminderStage: stageEnum }
      });
    }

    const phone = profile.user.phone?.trim();
    const amountLabel = price.toLocaleString("fr-FR");
    const graceEnd = profile.graceEndsAt
      ? billingUnit === "hour"
        ? profile.graceEndsAt.toLocaleString("fr-FR")
        : profile.graceEndsAt.toLocaleDateString("fr-FR")
      : "";
    const aheadLabel = billingUnit === "hour" ? "3 heures" : "3 jours";
    const message =
      stage === "j_minus_3"
        ? `Fermier Pro: votre Premium producteur renouvelle dans ${aheadLabel} (${amountLabel} XOF).`
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

    await this.prisma.producerProfile.update({
      where: { id: profile.id },
      data: { billingReminderKey: reminderKey }
    });
  }

  private async expirePremium(
    profile: ProducerProfile & { user: { id: string; phone: string | null } }
  ) {
    const cfg = await this.getBillingConfig();
    const billingDay = profile.nextBillingAt
      ? billingPeriodStart(profile.nextBillingAt, cfg.billingUnit)
      : null;
    if (billingDay) {
      await this.prisma.producerSubscriptionInvoice.updateMany({
        where: {
          producerProfileId: profile.id,
          billingPeriodStart: billingDay,
          status: MerchantSubscriptionInvoiceStatus.pending
        },
        data: { status: MerchantSubscriptionInvoiceStatus.expired }
      });
    }

    await this.prisma.producerProfile.update({
      where: { id: profile.id },
      data: {
        subscriptionTier: MerchantSubscriptionTier.free,
        subscriptionStatus: MerchantSubscriptionStatus.cancelled,
        graceEndsAt: null,
        billingReminderKey: null,
        trialEndsAt: null,
        cancelledAt: new Date(),
        suspendedAt: null,
        suspensionReason: null,
        nextBillingAt: null
      }
    });

    await this.producerTeam.revokeTeamAccessForOwner(profile.user.id);

    await this.prisma.producerSubscriptionInvoice.updateMany({
      where: {
        producerProfileId: profile.id,
        status: MerchantSubscriptionInvoiceStatus.pending
      },
      data: { status: MerchantSubscriptionInvoiceStatus.expired }
    });

    const phone = profile.user.phone?.trim();
    if (phone) {
      await this.sendSmsSafe(
        phone,
        "Fermier Pro: votre Premium producteur a expiré. Votre équipe a été retirée. Réabonnez-vous depuis l'application.",
        profile.id
      );
    }
  }

  async suspendProfile(profileId: string, reason?: string | null) {
    const profile = await this.prisma.producerProfile.findUnique({
      where: { id: profileId }
    });
    if (!profile || profile.subscriptionTier !== MerchantSubscriptionTier.premium) {
      throw new NotFoundException("Abonnement Premium introuvable");
    }
    await this.prisma.producerProfile.update({
      where: { id: profileId },
      data: {
        subscriptionStatus: MerchantSubscriptionStatus.suspended,
        suspendedAt: new Date(),
        suspensionReason: reason?.trim() || null
      }
    });
  }

  async resumeProfile(profileId: string) {
    const profile = await this.prisma.producerProfile.findUnique({
      where: { id: profileId }
    });
    if (
      !profile ||
      profile.subscriptionTier !== MerchantSubscriptionTier.premium ||
      profile.subscriptionStatus !== MerchantSubscriptionStatus.suspended
    ) {
      throw new NotFoundException("Abonnement suspendu introuvable");
    }
    const stillTrial =
      profile.trialEndsAt && profile.trialEndsAt.getTime() > Date.now();
    await this.prisma.producerProfile.update({
      where: { id: profileId },
      data: {
        subscriptionStatus: stillTrial
          ? MerchantSubscriptionStatus.trialing
          : MerchantSubscriptionStatus.active,
        suspendedAt: null,
        suspensionReason: null
      }
    });
  }

  async cancelProfile(profileId: string, _reason?: string | null) {
    const profile = await this.prisma.producerProfile.findUnique({
      where: { id: profileId },
      include: { user: { select: { id: true, phone: true } } }
    });
    if (!profile) {
      throw new NotFoundException("Profil producteur introuvable");
    }
    await this.expirePremium(profile);
  }

  async grantTrial(profileId: string, units?: number) {
    const cfg = await this.getBillingConfig();
    const trialUnits = Math.max(1, units ?? cfg.trialUnits);
    const from = new Date();
    const trialEndsAt = addBillingPeriod(from, cfg.billingUnit, trialUnits);
    await this.prisma.producerProfile.update({
      where: { id: profileId },
      data: {
        subscriptionTier: MerchantSubscriptionTier.premium,
        subscriptionStatus: MerchantSubscriptionStatus.trialing,
        subscriptionChosenAt: from,
        trialEndsAt,
        nextBillingAt: trialEndsAt,
        cancelledAt: null,
        suspendedAt: null,
        suspensionReason: null,
        graceEndsAt: null
      }
    });
  }

  async applyPromoOverride(profileId: string, percentOff: number) {
    const pct = Math.min(100, Math.max(0, Math.floor(percentOff)));
    await this.prisma.producerProfile.update({
      where: { id: profileId },
      data: { promoPercentOffApplied: pct }
    });
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
    const profile = await this.prisma.producerProfile.findUnique({
      where: { userId: user.id }
    });
    if (!profile || profile.subscriptionTier !== MerchantSubscriptionTier.premium) {
      return null;
    }
    const invoice = await this.prisma.producerSubscriptionInvoice.findFirst({
      where: {
        producerProfileId: profile.id,
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
    const profile = await this.prisma.producerProfile.findUnique({
      where: { userId: user.id }
    });
    if (!profile || profile.subscriptionTier !== MerchantSubscriptionTier.premium) {
      throw new NotFoundException("Abonnement Premium actif requis");
    }
    const price = await this.getPremiumPriceXof();
    const cfg = await this.getBillingConfig();
    const periodStart = profile.nextBillingAt
      ? billingPeriodStart(profile.nextBillingAt, cfg.billingUnit)
      : billingPeriodStart(new Date(), cfg.billingUnit);
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

  /** Force l'échéance passée (tests admin / QA). */
  async simulateBillingDue(profileId: string) {
    const profile = await this.prisma.producerProfile.findUnique({
      where: { id: profileId }
    });
    if (!profile || profile.subscriptionTier !== MerchantSubscriptionTier.premium) {
      throw new NotFoundException("Abonnement Premium requis");
    }
    const dueAt = new Date(Date.now() - 60_000);
    await this.prisma.producerProfile.update({
      where: { id: profileId },
      data: {
        nextBillingAt: dueAt,
        billingReminderKey: null,
        subscriptionStatus: MerchantSubscriptionStatus.active,
        graceEndsAt: null
      }
    });
    return dueAt;
  }

  /** Simule échéance + exécute le cycle de facturation (test renouvellement). */
  async triggerRenewalCycleForProfile(profileId: string) {
    await this.simulateBillingDue(profileId);
    await this.runBillingCycle();
    const profile = await this.prisma.producerProfile.findUnique({
      where: { id: profileId },
      include: { user: { select: { id: true, phone: true, email: true } } }
    });
    if (!profile) {
      throw new NotFoundException("Profil introuvable");
    }
    const pending = await this.prisma.producerSubscriptionInvoice.findFirst({
      where: {
        producerProfileId: profileId,
        status: MerchantSubscriptionInvoiceStatus.pending
      },
      orderBy: { dueDate: "desc" }
    });
    return {
      profileId,
      subscriptionStatus: profile.subscriptionStatus,
      nextBillingAt: profile.nextBillingAt?.toISOString() ?? null,
      graceEndsAt: profile.graceEndsAt?.toISOString() ?? null,
      pendingInvoice: pending
        ? {
            id: pending.id,
            amount: Number(pending.amount),
            paymentUrl: pending.paymentUrl,
            providerRef: pending.providerRef
          }
        : null
    };
  }
}
