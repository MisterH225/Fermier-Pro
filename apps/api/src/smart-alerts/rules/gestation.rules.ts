import type { PrismaClient } from "@prisma/client";
import {
  GestationStatus,
  GestationVaccineStatus,
  SmartAlertModule,
  SmartAlertPriority
} from "@prisma/client";
import type { ComputedSmartAlert } from "../smart-alerts.types";

const MS_DAY = 86_400_000;

function labelFromSow(sow: {
  tagCode: string | null;
  publicId: string;
}): string {
  return sow.tagCode?.trim() || sow.publicId.slice(0, 8);
}

export async function evaluateGestationRules(
  prisma: PrismaClient,
  farmId: string
): Promise<ComputedSmartAlert[]> {
  const out: ComputedSmartAlert[] = [];
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * MS_DAY);

  const active = await prisma.gestation.findMany({
    where: { farmId, status: GestationStatus.active },
    include: {
      sow: { select: { id: true, publicId: true, tagCode: true } },
      vaccines: true
    }
  });

  const due3 = active.filter((g) => {
    const d = Math.ceil(
      (g.expectedBirthDate.getTime() - now.getTime()) / MS_DAY
    );
    return d >= 0 && d <= 3;
  });
  if (due3.length > 0) {
    out.push({
      ruleKey: "gestation-due-3d",
      module: SmartAlertModule.gestation,
      priority: SmartAlertPriority.critical,
      title: "Mise bas imminente",
      message: `${due3.length} truie(s) mettent bas dans moins de 3 jours — préparer les loges maternité.`,
      action: {
        label: "Gestation",
        route: "FarmGestation",
        params: { farmId }
      }
    });
  }

  const due7only = active.filter((g) => {
    const d = Math.ceil(
      (g.expectedBirthDate.getTime() - now.getTime()) / MS_DAY
    );
    return d > 3 && d <= 7;
  });
  if (due7only.length > 0) {
    out.push({
      ruleKey: "gestation-due-7d",
      module: SmartAlertModule.gestation,
      priority: SmartAlertPriority.warning,
      title: "Mise bas cette semaine",
      message: `${due7only.length} truie(s) mettent bas cette semaine.`,
      action: {
        label: "Gestation",
        route: "FarmGestation",
        params: { farmId }
      }
    });
  }

  for (const g of active) {
    if (g.expectedBirthDate < now) {
      const label = labelFromSow(g.sow);
      const daysLate = Math.floor(
        (now.getTime() - g.expectedBirthDate.getTime()) / MS_DAY
      );
      out.push({
        ruleKey: `gestation-overdue:${g.id}`,
        module: SmartAlertModule.gestation,
        priority: SmartAlertPriority.critical,
        title: "Gestation dépassée",
        message: `${label} : gestation dépassée de ${daysLate} j — intervention vétérinaire requise.`,
        action: {
          label: "Gestation",
          route: "FarmGestation",
          params: { farmId, gestationId: g.id }
        }
      });
    }

    for (const v of g.vaccines) {
      const effectiveStatus =
        v.status === GestationVaccineStatus.pending &&
        v.scheduledDate < now
          ? GestationVaccineStatus.overdue
          : v.status;
      const label = labelFromSow(g.sow);
      if (effectiveStatus === GestationVaccineStatus.overdue) {
        out.push({
          ruleKey: `gestation-vaccine-overdue:${v.id}`,
          module: SmartAlertModule.gestation,
          priority: SmartAlertPriority.critical,
          title: "Vaccin en retard",
          message: `Vaccin ${v.vaccineName} en retard pour ${label} — administrer immédiatement.`,
          action: {
            label: "Gestation",
            route: "FarmGestation",
            params: { farmId, gestationId: g.id }
          }
        });
      } else if (
        effectiveStatus === GestationVaccineStatus.pending &&
        v.scheduledDate <= new Date(now.getTime() + 3 * MS_DAY)
      ) {
        const daysUntil = Math.ceil(
          (v.scheduledDate.getTime() - now.getTime()) / MS_DAY
        );
        out.push({
          ruleKey: `gestation-vaccine-soon:${v.id}`,
          module: SmartAlertModule.gestation,
          priority: SmartAlertPriority.warning,
          title: "Vaccin à planifier",
          message: `Vaccin ${v.vaccineName} à administrer dans ${daysUntil} j — ${label}.`,
          action: {
            label: "Gestation",
            route: "FarmGestation",
            params: { farmId, gestationId: g.id }
          }
        });
      }
    }
  }

  const available = await prisma.animal.findMany({
    where: { farmId, sex: "female", status: "active" },
    select: {
      id: true,
      publicId: true,
      tagCode: true,
      gestationsAsSow: {
        where: { status: GestationStatus.active },
        take: 1
      }
    }
  });
  for (const s of available) {
    if (s.gestationsAsSow.length > 0) {
      continue;
    }
    const lastCompleted = await prisma.gestation.findFirst({
      where: {
        farmId,
        sowId: s.id,
        status: GestationStatus.completed
      },
      orderBy: { actualBirthDate: "desc" },
      include: { litter: true }
    });
    const weaning = lastCompleted?.litter?.weaningDate;
    if (weaning && weaning > now) {
      continue;
    }
    const ref = weaning ?? lastCompleted?.actualBirthDate;
    if (!ref) {
      continue;
    }
    const daysSince = Math.floor((now.getTime() - ref.getTime()) / MS_DAY);
    if (daysSince > 21) {
      const label = labelFromSow(s);
      out.push({
        ruleKey: `gestation-sow-ready:${s.id}`,
        module: SmartAlertModule.gestation,
        priority: SmartAlertPriority.info,
        title: "Truie disponible",
        message: `${label} disponible pour saillie depuis ${daysSince} j — planifier accouplement.`,
        action: {
          label: "Planning saillies",
          route: "FarmGestation",
          params: { farmId, tab: "planning" }
        }
      });
    }
  }

  const weaningSoon = await prisma.litter.findMany({
    where: {
      farmId,
      weaningDate: { gte: now, lte: in7 }
    },
    include: {
      gestation: {
        include: {
          sow: { select: { publicId: true, tagCode: true } }
        }
      }
    }
  });
  for (const l of weaningSoon) {
    const daysUntil = Math.ceil(
      (l.weaningDate!.getTime() - now.getTime()) / MS_DAY
    );
    if (daysUntil <= 3) {
      const label = labelFromSow(l.gestation.sow);
      out.push({
        ruleKey: `gestation-weaning-soon:${l.id}`,
        module: SmartAlertModule.gestation,
        priority: SmartAlertPriority.warning,
        title: "Sevrage proche",
        message: `Sevrage de la portée de ${label} prévu dans ${daysUntil} j.`,
        action: {
          label: "Gestation",
          route: "FarmGestation",
          params: { farmId }
        }
      });
    }
  }

  return out;
}
