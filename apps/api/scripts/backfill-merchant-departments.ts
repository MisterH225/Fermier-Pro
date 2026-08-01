/**
 * Backfill departmentCode / geoResolutionSource pour les profils commerçants.
 * Réutilise GeoRollupService (P-10) — pas de nouveau resolver.
 *
 * Sources : coords MerchantProfile, locationCity, sinon locationLabel boutique,
 * sinon User.homeLatitude/homeLongitude (legacy).
 *
 * Usage (depuis apps/api, DATABASE_URL défini) :
 *   npm run backfill:merchant-departments --workspace @fermier/api
 */
import * as path from "node:path";
import { config as loadEnv } from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import { GeoRollupService } from "../src/farms/geo/geo-rollup.service";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });
loadEnv({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

function toNum(v: Prisma.Decimal | number | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const geo = new GeoRollupService(prisma as never);
  geo.onModuleInit();

  const profiles = await prisma.merchantProfile.findMany({
    select: {
      id: true,
      userId: true,
      merchantKind: true,
      latitude: true,
      longitude: true,
      locationCity: true,
      departmentCode: true,
      geoResolutionSource: true,
      user: {
        select: { homeLatitude: true, homeLongitude: true, homeLocationLabel: true }
      },
      shops: {
        where: { archivedAt: null },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { locationLabel: true }
      }
    }
  });

  let gps = 0;
  let locality = 0;
  let unresolved = 0;
  let copiedFromUser = 0;
  const unresolvedMills: string[] = [];

  for (const p of profiles) {
    let lat = toNum(p.latitude);
    let lng = toNum(p.longitude);
    let city = p.locationCity?.trim() || null;

    // Legacy : User.home* / boutique locationLabel si profil encore vide.
    if (lat == null && lng == null) {
      const uLat = toNum(p.user.homeLatitude);
      const uLng = toNum(p.user.homeLongitude);
      if (uLat != null && uLng != null) {
        lat = uLat;
        lng = uLng;
        copiedFromUser += 1;
      }
    }
    if (!city) {
      city =
        p.shops[0]?.locationLabel?.trim() ||
        p.user.homeLocationLabel?.trim() ||
        null;
    }

    const resolved = await geo.resolveFarmDepartment({
      latitude: lat,
      longitude: lng,
      locationCity: city,
      locationSector: null,
      address: null
    });

    await prisma.merchantProfile.update({
      where: { id: p.id },
      data: {
        latitude: lat != null ? new Prisma.Decimal(lat) : p.latitude,
        longitude: lng != null ? new Prisma.Decimal(lng) : p.longitude,
        locationCity: city ?? p.locationCity,
        departmentCode: resolved.departmentCode,
        geoResolutionSource: resolved.source
      }
    });

    if (resolved.source === "gps") gps += 1;
    else if (resolved.source === "locality") locality += 1;
    else {
      unresolved += 1;
      if (p.merchantKind === "mill" && unresolvedMills.length < 50) {
        unresolvedMills.push(p.id);
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        total: profiles.length,
        resolvedGps: gps,
        resolvedLocality: locality,
        unresolved,
        copiedCoordsFromUserHome: copiedFromUser,
        unresolvedMillSamples: unresolvedMills
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
