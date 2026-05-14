import type { PrismaClient } from "@prisma/client";
import { SmartAlertModule, SmartAlertPriority } from "@prisma/client";
import type { ComputedSmartAlert } from "../smart-alerts.types";

const MS_DAY = 86_400_000;

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
