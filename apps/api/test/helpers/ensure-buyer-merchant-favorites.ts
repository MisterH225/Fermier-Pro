import type { PrismaClient } from "@prisma/client";

/** Applique la migration favoris produits commerçants si la table est absente (CI / DB partielle). */
export async function ensureBuyerMerchantFavoriteTable(
  prisma: PrismaClient
): Promise<void> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'BuyerMerchantFavorite'
    ) AS "exists"
  `;
  if (rows[0]?.exists) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BuyerMerchantFavorite" (
      "id" TEXT NOT NULL,
      "buyerProfileId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BuyerMerchantFavorite_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "BuyerMerchantFavorite_buyerProfileId_productId_key"
      ON "BuyerMerchantFavorite"("buyerProfileId", "productId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "BuyerMerchantFavorite_buyerProfileId_idx"
      ON "BuyerMerchantFavorite"("buyerProfileId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "BuyerMerchantFavorite_productId_idx"
      ON "BuyerMerchantFavorite"("productId");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "BuyerMerchantFavorite" ADD CONSTRAINT "BuyerMerchantFavorite_buyerProfileId_fkey"
        FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "BuyerMerchantFavorite" ADD CONSTRAINT "BuyerMerchantFavorite_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "MerchantProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
}
