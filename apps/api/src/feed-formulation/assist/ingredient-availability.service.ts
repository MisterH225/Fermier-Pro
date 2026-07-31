import { Injectable, NotFoundException } from "@nestjs/common";
import type { FeedIngredientCategory } from "@prisma/client";
import {
  pricePerKg,
  resolveUnitToKg
} from "../../merchant-shop/mill-ingredient-packaging.util";
import { PrismaService } from "../../prisma/prisma.service";
import type { AvailableIngredientInput } from "../engine/feed-formulation.types";
import {
  REFERENCE_PRICE_PER_KG,
  THEORETICAL_MAX_AVAILABLE_KG
} from "./reference-prices";

export type IngredientAvailabilityResult = {
  availableIngredients: AvailableIngredientInput[];
  isTheoretical: boolean;
  millProfileId: string | null;
  warning?: string;
};

/**
 * Charge les intrants disponibles : offres moulin (prix/kg + stock)
 * ou catalogue FeedIngredient à prix de référence (théorique).
 */
@Injectable()
export class IngredientAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    millProfileId?: string | null
  ): Promise<IngredientAvailabilityResult> {
    if (millProfileId?.trim()) {
      return this.fromMill(millProfileId.trim());
    }
    return this.fromCatalog();
  }

  private async fromMill(
    millProfileId: string
  ): Promise<IngredientAvailabilityResult> {
    const mill = await this.prisma.merchantProfile.findFirst({
      where: {
        id: millProfileId,
        merchantKind: "mill",
        isActive: true
      },
      select: { id: true }
    });
    if (!mill) {
      throw new NotFoundException("Moulin introuvable ou inactif");
    }

    const offers = await this.prisma.millIngredientOffer.findMany({
      where: { millProfileId, isActive: true },
      include: { feedIngredient: { select: { id: true, isActive: true } } }
    });

    const byIngredient = new Map<string, AvailableIngredientInput>();
    for (const o of offers) {
      if (!o.feedIngredient.isActive) continue;
      const unitToKg = resolveUnitToKg(o.packaging, Number(o.unitToKg));
      const ppk = pricePerKg(Number(o.pricePerUnit), unitToKg);
      if (ppk == null) continue;
      const maxKg = Number(o.stockQuantity) * unitToKg;
      if (!(maxKg > 0)) continue;
      const mixing = o.mixingCostPerKg != null ? Number(o.mixingCostPerKg) : 0;
      const price = ppk + (Number.isFinite(mixing) ? mixing : 0);
      const prev = byIngredient.get(o.feedIngredientId);
      if (!prev || price < prev.pricePerKg) {
        byIngredient.set(o.feedIngredientId, {
          feedIngredientId: o.feedIngredientId,
          pricePerKg: price,
          maxAvailableKg: maxKg
        });
      } else if (prev) {
        // Cumuler le stock si même intrant à prix non meilleur.
        prev.maxAvailableKg += maxKg;
      }
    }

    if (byIngredient.size === 0) {
      return {
        ...(await this.fromCatalog()),
        warning:
          "Aucune offre active chez ce moulin — formulation théorique (prix de référence)."
      };
    }

    // Toujours joindre les prémélanges catalogue (CMV, sel…) pour les taux fixes
    // du stade — souvent absents des offres moulin marketplace.
    await this.mergeCatalogPremixes(byIngredient);

    return {
      availableIngredients: [...byIngredient.values()],
      isTheoretical: false,
      millProfileId
    };
  }

  /** Ajoute les isPremix actifs du catalogue s'ils manquent (prix de référence). */
  private async mergeCatalogPremixes(
    byIngredient: Map<string, AvailableIngredientInput>
  ): Promise<void> {
    const premixes = await this.prisma.feedIngredient.findMany({
      where: { isActive: true, isPremix: true },
      select: { id: true, category: true }
    });
    for (const r of premixes) {
      if (byIngredient.has(r.id)) continue;
      byIngredient.set(r.id, {
        feedIngredientId: r.id,
        pricePerKg: referencePrice(r.category),
        maxAvailableKg: THEORETICAL_MAX_AVAILABLE_KG
      });
    }
  }

  private async fromCatalog(): Promise<IngredientAvailabilityResult> {
    const rows = await this.prisma.feedIngredient.findMany({
      where: { isActive: true },
      select: { id: true, category: true }
    });
    const availableIngredients: AvailableIngredientInput[] = rows.map((r) => ({
      feedIngredientId: r.id,
      pricePerKg: referencePrice(r.category),
      maxAvailableKg: THEORETICAL_MAX_AVAILABLE_KG
    }));
    return {
      availableIngredients,
      isTheoretical: true,
      millProfileId: null,
      warning:
        "Formulation théorique au prix de référence catalogue (aucun moulin ciblé)."
    };
  }
}

function referencePrice(category: FeedIngredientCategory): number {
  return REFERENCE_PRICE_PER_KG[category] ?? 300;
}
