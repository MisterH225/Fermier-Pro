import { Injectable } from "@nestjs/common";
import { BuyerCreditScore } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type CreditScoreView = {
  score: BuyerCreditScore;
  emoji: string;
  label: string;
  color: string;
  blocked: boolean;
  creditTransactionsCount: number;
  creditOnTimeCount: number;
  creditLateCount: number;
  creditDefaultCount: number;
};

/**
 * Vue producteur — Météo Acheteur.
 * Jamais creditLateCount / creditDefaultCount (seulement le niveau agrégé).
 */
export type BuyerMeteoView = {
  creditScore: BuyerCreditScore;
  /** Identifiant MétéoProfil (7 niveaux). */
  meteoLevel: string;
  creditTransactionsCount: number;
  creditOnTimeCount: number;
  creditBlocked: boolean;
};

const SCORE_META: Record<
  BuyerCreditScore,
  { emoji: string; label: string; color: string }
> = {
  excellent: { emoji: "⭐", label: "Excellent", color: "#1D9E75" },
  bon: { emoji: "✅", label: "Bon", color: "#4A90D9" },
  nouveau: { emoji: "🆕", label: "Nouveau", color: "#B4B2A9" },
  attention: { emoji: "⚠️", label: "Attention", color: "#BA7517" },
  risque: { emoji: "🔴", label: "Risqué", color: "#E24B4A" }
};

/** Aligné sur apps/mobile/src/constants/meteoProfil.ts (creditScoreToNumeric + getMeteoLevel). */
const METEO_BY_SCORE: Record<BuyerCreditScore, string> = {
  excellent: "soleil_plomb",
  bon: "grande_chaleur",
  nouveau: "brise",
  attention: "eclaircie",
  risque: "debutant"
};

@Injectable()
export class CreditScoreService {
  constructor(private readonly prisma: PrismaService) {}

  meta(score: BuyerCreditScore) {
    return SCORE_META[score];
  }

  async getForUser(userId: string): Promise<CreditScoreView> {
    const row = await this.ensureProfile(userId);
    return this.toView(row);
  }

  /**
   * Batch de getForUser : 1 findMany (+ createMany si profils manquants).
   * Même vue que getForUser pour chaque userId.
   */
  async getForUsers(userIds: string[]): Promise<Map<string, CreditScoreView>> {
    const unique = [...new Set(userIds.filter(Boolean))];
    const out = new Map<string, CreditScoreView>();
    if (unique.length === 0) return out;

    let rows = await this.prisma.buyerProfile.findMany({
      where: { userId: { in: unique } }
    });
    const found = new Set(rows.map((r) => r.userId));
    const missing = unique.filter((id) => !found.has(id));
    if (missing.length > 0) {
      await this.prisma.buyerProfile.createMany({
        data: missing.map((userId) => ({ userId })),
        skipDuplicates: true
      });
      rows = await this.prisma.buyerProfile.findMany({
        where: { userId: { in: unique } }
      });
    }
    for (const row of rows) {
      out.set(row.userId, this.toView(row));
    }
    return out;
  }

  async getBuyerMeteoForUser(userId: string): Promise<BuyerMeteoView> {
    const view = await this.getForUser(userId);
    return this.toBuyerMeteo(view);
  }

  /** Payload sûr pour les producteurs (propositions reçues). */
  toBuyerMeteo(view: CreditScoreView): BuyerMeteoView {
    return {
      creditScore: view.score,
      meteoLevel: METEO_BY_SCORE[view.score],
      creditTransactionsCount: view.creditTransactionsCount,
      creditOnTimeCount: view.creditOnTimeCount,
      creditBlocked: view.blocked
    };
  }

  async isCreditBlocked(userId: string): Promise<boolean> {
    const row = await this.ensureProfile(userId);
    return (
      row.creditBlocked ||
      (row.creditScore === BuyerCreditScore.risque && row.creditDefaultCount > 0)
    );
  }

  async recordOnTimePayment(userId: string): Promise<CreditScoreView> {
    const row = await this.ensureProfile(userId);
    const onTime = row.creditOnTimeCount + 1;
    const total = row.creditTransactionsCount + 1;
    let score = row.creditScore;
    if (total >= 5 && onTime === total && row.creditLateCount === 0) {
      score = BuyerCreditScore.excellent;
    } else if (total >= 2 && row.creditLateCount <= 1) {
      score = BuyerCreditScore.bon;
    } else if (total === 1) {
      score = BuyerCreditScore.nouveau;
    }
    const blocked =
      row.creditDefaultCount > 0 && row.creditScore === BuyerCreditScore.risque
        ? row.creditBlocked
        : false;
    const updated = await this.prisma.buyerProfile.update({
      where: { userId },
      data: {
        creditTransactionsCount: total,
        creditOnTimeCount: onTime,
        creditScore: score,
        creditBlocked: blocked
      }
    });
    return this.toView(updated);
  }

  async recordLatePayment(userId: string): Promise<CreditScoreView> {
    const row = await this.ensureProfile(userId);
    const late = row.creditLateCount + 1;
    const total = row.creditTransactionsCount + 1;
    let score: BuyerCreditScore =
      late >= 2 || row.creditDefaultCount > 0
        ? BuyerCreditScore.attention
        : BuyerCreditScore.bon;
    if (late >= 3) {
      score = BuyerCreditScore.risque;
    }
    const updated = await this.prisma.buyerProfile.update({
      where: { userId },
      data: {
        creditTransactionsCount: total,
        creditLateCount: late,
        creditScore: score
      }
    });
    return this.toView(updated);
  }

  async recordArbitrationTriggered(userId: string): Promise<CreditScoreView> {
    const updated = await this.prisma.buyerProfile.update({
      where: { userId },
      data: {
        creditScore: BuyerCreditScore.attention,
        creditLateCount: { increment: 1 }
      }
    });
    return this.toView(updated);
  }

  async recordDefault(userId: string): Promise<CreditScoreView> {
    const updated = await this.prisma.buyerProfile.update({
      where: { userId },
      data: {
        creditScore: BuyerCreditScore.risque,
        creditDefaultCount: { increment: 1 },
        creditBlocked: true
      }
    });
    return this.toView(updated);
  }

  async recordDefaultResolved(userId: string): Promise<CreditScoreView> {
    const row = await this.ensureProfile(userId);
    const updated = await this.prisma.buyerProfile.update({
      where: { userId },
      data: {
        creditDefaultCount: Math.max(0, row.creditDefaultCount - 1),
        creditBlocked: false,
        creditScore:
          row.creditOnTimeCount >= 3
            ? BuyerCreditScore.bon
            : BuyerCreditScore.attention
      }
    });
    return this.toView(updated);
  }

  private async ensureProfile(userId: string) {
    return this.prisma.buyerProfile.upsert({
      where: { userId },
      create: { userId },
      update: {}
    });
  }

  private toView(row: {
    creditScore: BuyerCreditScore;
    creditBlocked: boolean;
    creditTransactionsCount: number;
    creditOnTimeCount: number;
    creditLateCount: number;
    creditDefaultCount: number;
  }): CreditScoreView {
    const meta = SCORE_META[row.creditScore];
    return {
      score: row.creditScore,
      emoji: meta.emoji,
      label: meta.label,
      color: meta.color,
      blocked: row.creditBlocked,
      creditTransactionsCount: row.creditTransactionsCount,
      creditOnTimeCount: row.creditOnTimeCount,
      creditLateCount: row.creditLateCount,
      creditDefaultCount: row.creditDefaultCount
    };
  }
}
