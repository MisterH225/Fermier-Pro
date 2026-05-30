import type { PrismaClient } from "@prisma/client";
import {
  PenCategory,
  SmartAlertModule,
  SmartAlertPriority
} from "@prisma/client";
import { buildPenAgeData } from "../../cheptel/age-calculation.util";
import type { ComputedSmartAlert } from "../smart-alerts.types";

const MS_DAY = 86_400_000;
const DEFAULT_STARTER_MAX_WEIGHT_KG = 30;
const DEFAULT_STARTER_MAX_AGE_WEEKS = 10;

export async function evaluateCheptelRules(
  prisma: PrismaClient,
  farmId: string
): Promise<ComputedSmartAlert[]> {
  const out: ComputedSmartAlert[] = [];

  const pens = await prisma.pen.findMany({
    where: { barn: { farmId }, status: "active", capacity: { not: null } },
    select: {
      id: true,
      name: true,
      capacity: true,
      barn: { select: { name: true } }
    }
  });

  for (const p of pens) {
    const cap = p.capacity!;
    const n = await prisma.penPlacement.count({
      where: { penId: p.id, endedAt: null }
    });
    if (cap > 0 && n >= cap) {
      out.push({
        ruleKey: `cheptel-pen-full:${p.id}`,
        module: SmartAlertModule.cheptel,
        priority: SmartAlertPriority.warning,
        title: "Loge pleine",
        message: `Loge « ${p.name} » (${p.barn.name}) à capacité max (${n}/${cap}) — vérifier densité.`,
        action: {
          label: "Logement",
          route: "FarmBarns",
          params: { farmId }
        }
      });
    }
  }

  // === Requalification loge Démarrage → Croissance ===
  // Émet une alerte (jamais un changement automatique) quand une loge taguée
  // « starter » dépasse l'un des seuils configurables sur FarmAlertSettings.
  // L'éleveur reste seul juge ; le tap action ouvre la fiche loge.
  const settings = await prisma.farmAlertSettings.findUnique({
    where: { farmId },
    select: {
      starterMaxAvgWeightKg: true,
      starterMaxAvgAgeWeeks: true
    }
  });
  const maxStarterWeight =
    settings?.starterMaxAvgWeightKg != null
      ? Number(settings.starterMaxAvgWeightKg)
      : DEFAULT_STARTER_MAX_WEIGHT_KG;
  const maxStarterAge =
    settings?.starterMaxAvgAgeWeeks != null
      ? settings.starterMaxAvgAgeWeeks
      : DEFAULT_STARTER_MAX_AGE_WEEKS;

  const starterPens = await prisma.pen.findMany({
    where: {
      barn: { farmId },
      status: "active",
      category: PenCategory.starter
    },
    select: {
      id: true,
      name: true,
      averageWeightKg: true,
      averageAgeWeeksManual: true,
      barn: { select: { id: true, name: true } },
      placements: {
        where: { endedAt: null, animalId: { not: null } },
        select: {
          animal: {
            select: {
              status: true,
              birthDate: true,
              ageWeeksAtEntry: true,
              entryDate: true
            }
          }
        }
      }
    }
  });

  const now = new Date();
  for (const p of starterPens) {
    const avgWeight =
      p.averageWeightKg != null ? Number(p.averageWeightKg) : null;
    const ageAnimals = p.placements
      .map((pl) => pl.animal)
      .filter(
        (a): a is NonNullable<typeof a> =>
          Boolean(a && a.status === "active")
      )
      .map((a) => ({
        birthDate: a.birthDate,
        ageWeeksAtEntry: a.ageWeeksAtEntry,
        entryDate: a.entryDate
      }));
    const ageData = buildPenAgeData(
      ageAnimals,
      p.averageAgeWeeksManual ?? null,
      now
    );
    const avgAge = ageData.displayAgeWeeks;
    const overWeight =
      avgWeight != null && Number.isFinite(avgWeight) && avgWeight > maxStarterWeight;
    const overAge = avgAge != null && avgAge > maxStarterAge;
    if (!overWeight && !overAge) {
      continue;
    }

    const reason = overWeight
      ? `poids moyen ${avgWeight!.toFixed(1)} kg > ${maxStarterWeight} kg`
      : `âge moyen ${avgAge} semaines > ${maxStarterAge} semaines`;

    out.push({
      ruleKey: `cheptel-pen-requalify:${p.id}`,
      module: SmartAlertModule.cheptel,
      priority: SmartAlertPriority.warning,
      title: "Requalification recommandée",
      message: `Loge « ${p.name} » (${p.barn.name}) est taguée Démarrage mais ${reason} — pensez à la reclasser en Croissance.`,
      action: {
        label: "Requalifier maintenant",
        route: "LogeDetail",
        params: { penId: p.id, farmId }
      }
    });
  }

  const staleBefore = new Date(Date.now() - 30 * MS_DAY);
  const staleCount = await prisma.animal.count({
    where: {
      farmId,
      status: "active",
      updatedAt: { lt: staleBefore }
    }
  });
  if (staleCount > 0) {
    out.push({
      ruleKey: "cheptel-stale-animals",
      module: SmartAlertModule.cheptel,
      priority: SmartAlertPriority.info,
      title: "Mises à jour cheptel",
      message: `${staleCount} sujet(s) sans mise à jour depuis 30 j.`,
      action: {
        label: "Cheptel",
        route: "FarmLivestock",
        params: { farmId }
      }
    });
  }

  return out;
}
