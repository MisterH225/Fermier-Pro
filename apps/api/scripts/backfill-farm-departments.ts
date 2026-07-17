/**
 * Backfill departmentCode / geoResolutionSource pour les fermes actives.
 *
 * Usage (depuis apps/api, DATABASE_URL défini) :
 *   npm run backfill:farm-departments --workspace @fermier/api
 */
import * as path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { GeoRollupService } from "../src/farms/geo/geo-rollup.service";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });
loadEnv({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

async function main() {
  const geo = new GeoRollupService(prisma as never);
  geo.onModuleInit();

  const farms = await prisma.farm.findMany({
    where: { status: "active" },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      locationCity: true,
      address: true,
      departmentCode: true,
      geoResolutionSource: true
    }
  });

  let gps = 0;
  let locality = 0;
  let unresolved = 0;
  const unresolvedSamples: Array<{
    id: string;
    name: string;
    locationCity: string | null;
    address: string | null;
  }> = [];

  for (const farm of farms) {
    const resolved = await geo.resolveFarmDepartment(farm);
    await prisma.farm.update({
      where: { id: farm.id },
      data: {
        departmentCode: resolved.departmentCode,
        geoResolutionSource: resolved.source
      }
    });
    if (resolved.source === "gps") gps += 1;
    else if (resolved.source === "locality") locality += 1;
    else {
      unresolved += 1;
      if (unresolvedSamples.length < 50) {
        unresolvedSamples.push({
          id: farm.id,
          name: farm.name,
          locationCity: farm.locationCity,
          address: farm.address
        });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        total: farms.length,
        resolvedGps: gps,
        resolvedLocality: locality,
        unresolved,
        unresolvedSamples
      },
      null,
      2
    )
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
