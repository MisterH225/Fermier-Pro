/**
 * Backfill initial des snapshots RegionStatsDaily.
 *
 * Usage (depuis apps/api, DATABASE_URL défini) :
 *   npm run backfill:region-stats --workspace @fermier/api
 *   npm run backfill:region-stats --workspace @fermier/api -- --from=2025-01-01 --to=2026-07-16
 */
import * as path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { RegionStatsSnapshotService } from "../src/admin-platform/region-stats-snapshot.service";
import {
  addUtcDays,
  startOfUtcDay
} from "../src/admin-platform/region-stats-date.util";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });
loadEnv({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit?.slice(prefix.length);
}

async function resolveDefaultFrom(): Promise<Date> {
  const candidates = await Promise.all([
    prisma.animal.findFirst({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true }
    }),
    prisma.livestockExit.findFirst({
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true }
    }),
    prisma.litter.findFirst({
      orderBy: { recordedAt: "asc" },
      select: { recordedAt: true }
    }),
    prisma.vetConsultation.findFirst({
      orderBy: { openedAt: "asc" },
      select: { openedAt: true }
    })
  ]);

  const timestamps = candidates
    .map((row) =>
      row
        ? "createdAt" in row
          ? row.createdAt
          : "occurredAt" in row
            ? row.occurredAt
            : "recordedAt" in row
              ? row.recordedAt
              : row.openedAt
        : null
    )
    .filter((d): d is Date => d instanceof Date);

  if (timestamps.length === 0) {
    return addUtcDays(startOfUtcDay(new Date()), -365);
  }

  const earliest = timestamps.reduce((min, d) =>
    d.getTime() < min.getTime() ? d : min
  );
  return startOfUtcDay(earliest);
}

async function main() {
  const service = new RegionStatsSnapshotService(prisma as never);
  const defaultTo = addUtcDays(startOfUtcDay(new Date()), -1);
  const defaultFrom = await resolveDefaultFrom();

  const from = startOfUtcDay(
    parseArg("from") ? new Date(`${parseArg("from")}T00:00:00.000Z`) : defaultFrom
  );
  const to = startOfUtcDay(
    parseArg("to") ? new Date(`${parseArg("to")}T00:00:00.000Z`) : defaultTo
  );

  if (from.getTime() > to.getTime()) {
    throw new Error(
      `Plage invalide : from=${from.toISOString().slice(0, 10)} > to=${to.toISOString().slice(0, 10)}`
    );
  }

  const dayCount =
    Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  console.log(
    `[backfill:region-stats] ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)} (${dayCount} jour(s))`
  );

  await service.backfillRange(from, to);

  const rows = await prisma.regionStatsDaily.count({
    where: { date: { gte: from, lte: to } }
  });
  console.log(`[backfill:region-stats] terminé — ${rows} ligne(s) RegionStatsDaily`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
