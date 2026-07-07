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
  MerchantSubscriptionTier
} from "@prisma/client";
import { EscrowService } from "../marketplace/escrow/escrow.service";
import { PrismaService } from "../prisma/prisma.service";
import { UserWalletService } from "../wallet/user-wallet.service";
import { MERCHANT_FREE_MAX_ACTIVE_PRODUCTS } from "./merchant-shop.constants";
import type { ChooseMerchantSubscriptionDto } from "./dto/merchant-shop.dto";
import { MerchantProfilesService } from "./merchant-profiles.service";

@Injectable()
export class MerchantSubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: MerchantProfilesService,
    private readonly wallet: UserWalletService,
    private readonly escrow: EscrowService
  ) {}

  private premiumRef(userId: string): string {
    return `merchant-premium:${userId}`;
  }

  async choose(user: User, dto: ChooseMerchantSubscriptionDto) {
    const profile = await this.profiles.ensureProfile(user.id);
    if (profile.subscriptionTier) {
      return this.profiles.getMe(user);
    }

    if (dto.tier === MerchantSubscriptionTier.free) {
      await this.prisma.merchantProfile.update({
        where: { userId: user.id },
        data: {
          subscriptionTier: MerchantSubscriptionTier.free,
          subscriptionChosenAt: new Date()
        }
      });
      return this.profiles.getMe(user);
    }

    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "default" }
    });
    const price = Number(settings?.merchantPremiumPriceXof ?? 5000);
    const method =
      dto.paymentMethod ?? MarketplacePaymentMethod.mobile_money;

    if (method === MarketplacePaymentMethod.wallet) {
      await this.wallet.assertSufficientBalance(user.id, price);
      await this.wallet.debitForMerchantHold(
        user.id,
        price,
        "XOF",
        this.premiumRef(user.id),
        "Abonnement Premium commerçant"
      );
      await this.prisma.merchantProfile.update({
        where: { userId: user.id },
        data: {
          subscriptionTier: MerchantSubscriptionTier.premium,
          subscriptionChosenAt: new Date(),
          premiumPaidAt: new Date()
        }
      });
      return this.profiles.getMe(user);
    }

    const init = await this.escrow.holdFunds(
      this.premiumRef(user.id),
      user.id,
      price,
      "XOF",
      "Abonnement Premium commerçant",
      { paymentMethod: method }
    );
    return {
      pending: true,
      tier: MerchantSubscriptionTier.premium,
      amount: price,
      paymentMethod: method,
      providerRef: init.providerRef,
      paymentUrl: init.paymentUrl ?? null
    };
  }

  async confirmPremiumPayment(user: User, providerRef: string) {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { userId: user.id }
    });
    if (!profile) {
      throw new NotFoundException("Profil commerçant introuvable");
    }
    if (profile.subscriptionTier === MerchantSubscriptionTier.premium) {
      return this.profiles.getMe(user);
    }

    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "default" }
    });
    const price = Number(settings?.merchantPremiumPriceXof ?? 5000);

    if (this.wallet.isWalletPendingRef(providerRef)) {
      await this.wallet.debitForMerchantHold(
        user.id,
        price,
        "XOF",
        this.premiumRef(user.id),
        "Abonnement Premium commerçant"
      );
    } else {
      await this.escrow.confirmHold(providerRef, this.premiumRef(user.id), {
        buyerUserId: user.id,
        amount: price,
        currency: "XOF",
        label: "Abonnement Premium commerçant"
      });
    }

    await this.prisma.merchantProfile.update({
      where: { userId: user.id },
      data: {
        subscriptionTier: MerchantSubscriptionTier.premium,
        subscriptionChosenAt: new Date(),
        premiumPaidAt: new Date()
      }
    });
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
        data: { subscriptionTier: MerchantSubscriptionTier.free }
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
