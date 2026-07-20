import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { APP_EVENT } from "./app-events.constants";

type CountMap = Record<string, number>;

function emptyBuckets(): CountMap {
  return { "0-40": 0, "40-70": 0, "70-100": 0 };
}

function emptySources(): CountMap {
  return {
    banner_cta: 0,
    vet_search: 0,
    farm_dossier: 0,
    renewal_notification: 0
  };
}

function emptyDecisions(): CountMap {
  return { accepted: 0, rejected: 0 };
}

function emptyMeteo(): CountMap {
  return {};
}

function asRecord(props: unknown): Record<string, unknown> {
  if (props && typeof props === "object" && !Array.isArray(props)) {
    return props as Record<string, unknown>;
  }
  return {};
}

function bump(map: CountMap, key: string, n = 1): void {
  map[key] = (map[key] ?? 0) + n;
}

export type AdoptionWindowMetrics = {
  days: number;
  profileCompletionBuckets: {
    buyer: CountMap;
    vet: CountMap;
  };
  listingHealthBadge: {
    samples: number;
    latest: {
      dayKey: string;
      total: number;
      badged: number;
      ratio: number;
    } | null;
    avgRatio: number | null;
  };
  offerDecisions: {
    byDecision: CountMap;
    byMeteoLevel: CountMap;
  };
  vetBookingSources: CountMap;
};

@Injectable()
export class AdoptionMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdoptionMetrics(): Promise<{
    generatedAt: string;
    windows: { "7d": AdoptionWindowMetrics; "30d": AdoptionWindowMetrics };
  }> {
    const now = new Date();
    const [w7, w30] = await Promise.all([
      this.buildWindow(7, now),
      this.buildWindow(30, now)
    ]);
    return {
      generatedAt: now.toISOString(),
      windows: { "7d": w7, "30d": w30 }
    };
  }

  private async buildWindow(
    days: number,
    now: Date
  ): Promise<AdoptionWindowMetrics> {
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.appEvent.findMany({
      where: {
        name: {
          in: [
            APP_EVENT.profileCompletionBucket,
            APP_EVENT.listingHealthBadge,
            APP_EVENT.offerDecision,
            APP_EVENT.vetBookingSource
          ]
        },
        createdAt: { gte: since }
      },
      select: { name: true, props: true, createdAt: true },
      orderBy: { createdAt: "asc" }
    });

    const buyerBuckets = emptyBuckets();
    const vetBuckets = emptyBuckets();
    const byDecision = emptyDecisions();
    const byMeteoLevel = emptyMeteo();
    const vetSources = emptySources();
    const healthSamples: Array<{
      dayKey: string;
      total: number;
      badged: number;
      ratio: number;
    }> = [];

    for (const row of rows) {
      const props = asRecord(row.props);
      if (row.name === APP_EVENT.profileCompletionBucket) {
        const role = String(props.role ?? "");
        const bucket = String(props.bucket ?? "");
        if (role === "buyer" && bucket in buyerBuckets) {
          bump(buyerBuckets, bucket);
        } else if (role === "vet" && bucket in vetBuckets) {
          bump(vetBuckets, bucket);
        }
      } else if (row.name === APP_EVENT.listingHealthBadge) {
        const total = Number(props.total);
        const badged = Number(props.badged);
        const ratio = Number(props.ratio);
        const dayKey = String(props.dayKey ?? "");
        if (
          Number.isFinite(total) &&
          Number.isFinite(badged) &&
          Number.isFinite(ratio)
        ) {
          healthSamples.push({
            dayKey,
            total,
            badged,
            ratio
          });
        }
      } else if (row.name === APP_EVENT.offerDecision) {
        const decision = String(props.decision ?? "");
        const meteoLevel = String(props.meteoLevel ?? "");
        if (decision === "accepted" || decision === "rejected") {
          bump(byDecision, decision);
        }
        if (meteoLevel) {
          bump(byMeteoLevel, meteoLevel);
        }
      } else if (row.name === APP_EVENT.vetBookingSource) {
        const source = String(props.source ?? "");
        if (source in vetSources) {
          bump(vetSources, source);
        } else if (source) {
          bump(vetSources, source);
        }
      }
    }

    const latest = healthSamples.length
      ? healthSamples[healthSamples.length - 1]!
      : null;
    const avgRatio =
      healthSamples.length > 0
        ? Math.round(
            (healthSamples.reduce((s, x) => s + x.ratio, 0) /
              healthSamples.length) *
              10_000
          ) / 10_000
        : null;

    return {
      days,
      profileCompletionBuckets: { buyer: buyerBuckets, vet: vetBuckets },
      listingHealthBadge: {
        samples: healthSamples.length,
        latest,
        avgRatio
      },
      offerDecisions: { byDecision, byMeteoLevel },
      vetBookingSources: vetSources
    };
  }
}
