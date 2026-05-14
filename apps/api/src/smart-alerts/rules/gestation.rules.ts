import type { PrismaClient } from "@prisma/client";
import { SmartAlertModule, SmartAlertPriority } from "@prisma/client";
import type { ComputedSmartAlert } from "../smart-alerts.types";

const MS_DAY = 86_400_000;

export async function evaluateGestationRules(
  prisma: PrismaClient,
  farmId: string
): Promise<ComputedSmartAlert[]> {
  const out: ComputedSmartAlert[] = [];
  const now = new Date();

  const in7 = await prisma.animal.findMany({
    where: {
      farmId,
      status: "active",
      expectedFarrowingAt: { gte: now, lte: new Date(now.getTime() + 7 * MS_DAY) }
    },
    select: {
      id: true,
      publicId: true,
      tagCode: true,
      expectedFarrowingAt: true
    }
  });

  const urgent3 = in7.filter((a) => {
    const d = Math.ceil(
      (a.expectedFarrowingAt!.getTime() - now.getTime()) / MS_DAY
    );
    return d <= 3;
  });
  if (urgent3.length > 0) {
    out.push({
      ruleKey: "gestation-due-3d",
      module: SmartAlertModule.gestation,
      priority: SmartAlertPriority.critical,
      title: "Mise bas imminente",
      message: `${urgent3.length} truie(s) mettent bas dans moins de 3 jours — préparer les loges.`,
      action: {
        label: "Cheptel",
        route: "FarmLivestock",
        params: { farmId }
      }
    });
  }

  const weekOnly = in7.filter((a) => {
    const d = Math.ceil(
      (a.expectedFarrowingAt!.getTime() - now.getTime()) / MS_DAY
    );
    return d > 3 && d <= 7;
  });
  if (weekOnly.length > 0) {
    out.push({
      ruleKey: "gestation-due-7d",
      module: SmartAlertModule.gestation,
      priority: SmartAlertPriority.warning,
      title: "Mise bas cette semaine",
      message: `${weekOnly.length} truie(s) mettent bas cette semaine.`,
      action: {
        label: "Cheptel",
        route: "FarmLivestock",
        params: { farmId }
      }
    });
  }

  const overdue = await prisma.animal.findMany({
    where: {
      farmId,
      status: "active",
      expectedFarrowingAt: { lt: now }
    },
    select: { id: true, publicId: true, tagCode: true, expectedFarrowingAt: true },
    take: 20
  });
  for (const a of overdue) {
    const label = a.tagCode?.trim() || a.publicId.slice(0, 8);
    const daysLate = Math.floor(
      (now.getTime() - a.expectedFarrowingAt!.getTime()) / MS_DAY
    );
    out.push({
      ruleKey: `gestation-overdue:${a.id}`,
      module: SmartAlertModule.gestation,
      priority: SmartAlertPriority.critical,
      title: "Gestation dépassée",
      message: `${label} : date prévue dépassée de ${daysLate} j — intervention requise.`,
      action: {
        label: "Fiche animal",
        route: "AnimalDetail",
        params: { farmId, animalId: a.id, headline: label }
      }
    });
  }

  return out;
}
