import type { PrismaClient } from "@prisma/client";
import {
  FarmDiseaseCaseStatus,
  FarmHealthRecordKind,
  SmartAlertModule,
  SmartAlertPriority
} from "@prisma/client";
import type { ComputedSmartAlert, FarmAlertThresholds } from "../smart-alerts.types";

const MS_DAY = 86_400_000;

export async function evaluateHealthRules(
  prisma: PrismaClient,
  farmId: string,
  th: FarmAlertThresholds
): Promise<ComputedSmartAlert[]> {
  const out: ComputedSmartAlert[] = [];
  const now = new Date();

  const overdueDetails = await prisma.healthVaccinationDetail.findMany({
    where: {
      healthRecord: { farmId },
      nextReminderAt: { lt: now }
    },
    select: {
      vaccineName: true,
      nextReminderAt: true,
      healthRecord: { select: { entityType: true, entityId: true } }
    },
    take: 200
  });

  const byVaccine = new Map<string, number>();
  for (const d of overdueDetails) {
    const name = d.vaccineName.trim() || "Vaccin";
    byVaccine.set(name, (byVaccine.get(name) ?? 0) + 1);
  }
  for (const [vaccineName, count] of byVaccine) {
    const sample = overdueDetails.find(
      (x) => (x.vaccineName.trim() || "Vaccin") === vaccineName
    );
    const daysLate = sample?.nextReminderAt
      ? Math.max(
          1,
          Math.floor((now.getTime() - sample.nextReminderAt.getTime()) / MS_DAY)
        )
      : 1;
    out.push({
      ruleKey: `health-vac-overdue:${vaccineName}`.slice(0, 120),
      module: SmartAlertModule.health,
      priority: SmartAlertPriority.critical,
      title: "Vaccination en retard",
      message: `Vaccination « ${vaccineName} » dépassée de ${daysLate} j — ${count} rappel(s) concerné(s).`,
      action: {
        label: "Ouvrir santé",
        route: "FarmHealth",
        params: { farmId }
      }
    });
  }

  const soonVac = await prisma.healthVaccinationDetail.findMany({
    where: {
      healthRecord: { farmId },
      nextReminderAt: { gte: now, lte: new Date(now.getTime() + 7 * MS_DAY) }
    },
    orderBy: { nextReminderAt: "asc" },
    take: 10,
    select: { vaccineName: true, nextReminderAt: true }
  });
  for (const v of soonVac) {
    const days = Math.ceil(
      (v.nextReminderAt!.getTime() - now.getTime()) / MS_DAY
    );
    const name = v.vaccineName.trim() || "Vaccin";
    out.push({
      ruleKey: `health-vac-soon:${v.nextReminderAt!.toISOString()}:${name}`.slice(
        0,
        120
      ),
      module: SmartAlertModule.health,
      priority:
        days <= 3 ? SmartAlertPriority.warning : SmartAlertPriority.warning,
      title: "Rappel vaccin",
      message: `Rappel vaccin « ${name} » dans ${days} j.`,
      action: {
        label: "Santé",
        route: "FarmHealth",
        params: { farmId }
      }
    });
  }

  const vetSoon = await prisma.farmHealthRecord.findMany({
    where: {
      farmId,
      kind: FarmHealthRecordKind.vet_visit,
      occurredAt: {
        gte: now,
        lte: new Date(now.getTime() + 3 * MS_DAY)
      },
      OR: [{ status: "planned" }, { occurredAt: { gte: now } }]
    },
    orderBy: { occurredAt: "asc" },
    take: 5,
    include: { vetVisit: true }
  });
  for (const r of vetSoon) {
    const days = Math.ceil(
      (r.occurredAt.getTime() - now.getTime()) / MS_DAY
    );
    if (days >= 0 && days <= 3) {
      out.push({
        ruleKey: `health-vet-visit:${r.id}`,
        module: SmartAlertModule.health,
        priority: SmartAlertPriority.warning,
        title: "Visite vétérinaire",
        message: `Visite vétérinaire prévue dans ${days} j (${r.vetVisit?.reason ?? "motif à préciser"}).`,
        action: {
          label: "Santé",
          route: "FarmHealth",
          params: { farmId }
        }
      });
    }
  }

  const diseases = await prisma.farmHealthRecord.findMany({
    where: {
      farmId,
      kind: FarmHealthRecordKind.disease,
      disease: { caseStatus: FarmDiseaseCaseStatus.active }
    },
    select: { id: true, occurredAt: true, disease: { select: { diagnosis: true } } }
  });
  for (const d of diseases) {
    const days = Math.floor(
      (now.getTime() - d.occurredAt.getTime()) / MS_DAY
    );
    if (days > 5) {
      out.push({
        ruleKey: `health-disease-long:${d.id}`,
        module: SmartAlertModule.health,
        priority: SmartAlertPriority.critical,
        title: "Cas maladie prolongé",
        message: `Cas maladie actif depuis ${days} j — suivi requis (${d.disease?.diagnosis?.slice(0, 80) ?? "dossier santé"}).`,
        action: {
          label: "Santé",
          route: "FarmHealth",
          params: { farmId }
        }
      });
    }
  }

  const since30 = new Date(now.getTime() - 30 * MS_DAY);
  const mortalAgg = await prisma.livestockExit.aggregate({
    where: {
      farmId,
      kind: "mortality",
      occurredAt: { gte: since30 }
    },
    _sum: { headcountAffected: true }
  });
  const dead = mortalAgg._sum.headcountAffected ?? 0;
  const activeHead = await prisma.animal.count({
    where: { farmId, status: "active" }
  });
  const rate = (dead / Math.max(1, activeHead + dead)) * 100;
  if (rate > th.mortalityRateThresholdPct) {
    out.push({
      ruleKey: "health-mortality-month",
      module: SmartAlertModule.health,
      priority: SmartAlertPriority.critical,
      title: "Mortalité élevée",
      message: `Taux mortalité : ${rate.toFixed(2)} % sur 30 j — au-dessus du seuil (${th.mortalityRateThresholdPct} %).`,
      action: {
        label: "Santé",
        route: "FarmHealth",
        params: { farmId }
      }
    });
  }

  return out;
}
